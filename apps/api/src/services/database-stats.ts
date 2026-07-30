import { createDb, schema } from "@trademark-engine/database";
import { count, desc, eq } from "drizzle-orm";

export interface DatabaseStats {
  readonly mode: "database";
  readonly trademarkCount: number;
  readonly corpusSourceCount: number;
  readonly searchableCount: number;
  readonly normalizedCount: number;
  readonly snapshotCount: number;
  readonly ready: boolean;
}

export interface DatabaseSnapshotSummary {
  readonly mode: "database";
  readonly id: string | null;
  readonly searchableRecordCount: number;
  readonly totalRecordCount: number;
  readonly normalizationVersion: string;
  readonly phoneticVersion: string;
  readonly goodsTaxonomyVersion: string;
  readonly createdAt: string | null;
}

export async function fetchDatabaseStats(databaseUrl: string): Promise<DatabaseStats> {
  const db = createDb(databaseUrl);

  try {
    const [trademarkRow] = await db
      .select({ count: count() })
      .from(schema.trademark);
    const [sourceRow] = await db
      .select({ count: count() })
      .from(schema.corpusSource);
    const [searchableRow] = await db
      .select({ count: count() })
      .from(schema.trademark)
      .where(eq(schema.trademark.isTextSearchable, true));
    const [normalizedRow] = await db
      .select({ count: count() })
      .from(schema.trademarkNormalizedRepresentation);
    const [snapshotRow] = await db
      .select({ count: count() })
      .from(schema.databaseSnapshot);

    const trademarkCount = trademarkRow?.count ?? 0;
    const searchableCount = searchableRow?.count ?? 0;
    const normalizedCount = normalizedRow?.count ?? 0;

    return {
      mode: "database",
      trademarkCount,
      corpusSourceCount: sourceRow?.count ?? 0,
      searchableCount,
      normalizedCount,
      snapshotCount: snapshotRow?.count ?? 0,
      ready: searchableCount > 0 && normalizedCount > 0,
    };
  } finally {
    await db.$client.end();
  }
}

export async function fetchDatabaseSnapshot(
  databaseUrl: string,
): Promise<DatabaseSnapshotSummary> {
  const db = createDb(databaseUrl);

  try {
    const [latest] = await db
      .select()
      .from(schema.databaseSnapshot)
      .orderBy(desc(schema.databaseSnapshot.createdAt))
      .limit(1);

    if (!latest) {
      const stats = await fetchDatabaseStats(databaseUrl);
      return {
        mode: "database",
        id: null,
        searchableRecordCount: stats.searchableCount,
        totalRecordCount: stats.trademarkCount,
        normalizationVersion: "1.0.0",
        phoneticVersion: "1.0.0",
        goodsTaxonomyVersion: "1.0.0",
        createdAt: null,
      };
    }

    return {
      mode: "database",
      id: latest.id,
      searchableRecordCount: latest.searchableRecordCount,
      totalRecordCount: latest.totalRecordCount,
      normalizationVersion: latest.normalizationVersion,
      phoneticVersion: latest.phoneticVersion,
      goodsTaxonomyVersion: latest.goodsTaxonomyVersion,
      createdAt: latest.createdAt.toISOString(),
    };
  } finally {
    await db.$client.end();
  }
}
