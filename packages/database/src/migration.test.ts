import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb } from "./db.js";
import { migrate } from "./migrate.js";
import { corpusSource, trademark } from "./schema.js";

async function resolveDatabaseUrl(): Promise<{
  url: string;
  container?: StartedPostgreSqlContainer;
  skipReason?: string;
}> {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL };
  }

  try {
    const container = await new PostgreSqlContainer("postgres:16")
      .withDatabase("trademark_engine_test")
      .withUsername("trademark")
      .withPassword("trademark")
      .start();
    return { url: container.getConnectionUri(), container };
  } catch {
    return {
      url: "",
      skipReason:
        "Skipping database integration tests: Docker unavailable and DATABASE_URL not set",
    };
  }
}

describe("engine schema migration", () => {
  let connectionUrl = "";
  let skipReason: string | undefined;
  let container: StartedPostgreSqlContainer | undefined;

  beforeAll(async () => {
    const resolved = await resolveDatabaseUrl();
    skipReason = resolved.skipReason;
    if (skipReason) {
      return;
    }
    connectionUrl = resolved.url;
    container = resolved.container;
    await migrate(connectionUrl);
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it("applies clean migration and enforces unique source_record_id per corpus", async (ctx) => {
    if (skipReason) {
      ctx.skip(skipReason);
      return;
    }

    const db = createDb(connectionUrl);

    try {
      const [source] = await db
        .insert(corpusSource)
        .values({ code: "test_source", name: "Test Source" })
        .returning();

      if (!source) {
        throw new Error("Failed to insert corpus source");
      }

      await db.insert(trademark).values({
        corpusSourceId: source.id,
        sourceRecordId: "TM-001",
        applicationNumber: "TM-001",
        markText: "ACME",
        statusCode: "REGISTERED",
        normalizedStatus: "registered",
        niceClasses: [35],
        isTextSearchable: true,
        sourceHash: "abc123",
        mappingVersion: "1.0.0",
        mappedAt: new Date(),
      });

      await expect(
        db.insert(trademark).values({
          corpusSourceId: source.id,
          sourceRecordId: "TM-001",
          applicationNumber: "TM-001",
          markText: "ACME DUPLICATE",
          statusCode: "REGISTERED",
          normalizedStatus: "registered",
          niceClasses: [35],
          isTextSearchable: true,
          sourceHash: "def456",
          mappingVersion: "1.0.0",
          mappedAt: new Date(),
        }),
      ).rejects.toThrow();

      const rows = await db
        .select()
        .from(trademark)
        .where(eq(trademark.sourceRecordId, "TM-001"));

      expect(rows).toHaveLength(1);
    } finally {
      await closeDb(db);
    }
  });
});
