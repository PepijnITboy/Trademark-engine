import {
  closeDb,
  createDb,
  migrate,
  trademark,
} from "@trademark-engine/database";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bridgeSampleRows } from "./bridge-sample.js";
import { CORPUS_SOURCE_EUROPA_LOCAL } from "./types.js";
import type { CorpusRow } from "./types.js";

const sampleRows: CorpusRow[] = [
  {
    application_number: "018999001",
    mark_name: "BRIDGE TEST",
    status: "REGISTERED",
    nice_classes: [35],
    application_date: "2021-03-01",
    registration_date: "2021-08-01",
  },
];

describe("bridgeSampleRows integration", () => {
  const databaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }
    await migrate(databaseUrl);
  });

  afterAll(async () => {
    // connection closed per test
  });

  it("double bridge is idempotent and does not duplicate trademarks", async (ctx) => {
    if (!databaseUrl) {
      ctx.skip();
      return;
    }

    const db = createDb(databaseUrl);

    try {
      const first = await bridgeSampleRows(db, sampleRows);
      const second = await bridgeSampleRows(db, sampleRows);

      expect(first.upsertedCount).toBe(1);
      expect(first.unchangedCount).toBe(0);
      expect(second.upsertedCount).toBe(0);
      expect(second.unchangedCount).toBe(1);
      expect(first.trademarkIds[0]).toBe(second.trademarkIds[0]);

      const [rowCount] = await db
        .select({ value: count() })
        .from(trademark)
        .where(eq(trademark.sourceRecordId, sampleRows[0]!.application_number));

      expect(rowCount?.value).toBe(1);
    } finally {
      await closeDb(db);
    }
  });
});

describe("corpus source code constant", () => {
  it("uses europa_local", () => {
    expect(CORPUS_SOURCE_EUROPA_LOCAL).toBe("europa_local");
  });
});
