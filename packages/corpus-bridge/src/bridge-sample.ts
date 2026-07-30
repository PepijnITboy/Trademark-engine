import {
  corpusSource,
  trademark,
  type Database,
} from "@trademark-engine/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import { mapCorpusRowToTrademark } from "./map-corpus-row.js";
import { CORPUS_SOURCE_EUROPA_LOCAL, type CorpusRow } from "./types.js";

export interface BridgeSampleResult {
  corpusSourceId: string;
  trademarkIds: string[];
  upsertedCount: number;
  unchangedCount: number;
}

const UPSERT_CHUNK = 500;

export async function bridgeSampleRows(
  db: Database,
  rows: CorpusRow[],
): Promise<BridgeSampleResult> {
  const [source] = await db
    .insert(corpusSource)
    .values({
      code: CORPUS_SOURCE_EUROPA_LOCAL,
      name: "Europa Local Corpus",
    })
    .onConflictDoUpdate({
      target: corpusSource.code,
      set: {
        name: sql`excluded.name`,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!source) {
    throw new Error("Failed to upsert corpus source");
  }

  if (rows.length === 0) {
    return {
      corpusSourceId: source.id,
      trademarkIds: [],
      upsertedCount: 0,
      unchangedCount: 0,
    };
  }

  const mappedRows = rows.map((row) => ({
    row,
    mapped: mapCorpusRowToTrademark(row, source.id),
  }));

  const sourceRecordIds = mappedRows.map((item) => item.row.application_number);
  const existingRows = await db
    .select({
      id: trademark.id,
      sourceRecordId: trademark.sourceRecordId,
      sourceHash: trademark.sourceHash,
    })
    .from(trademark)
    .where(
      and(
        eq(trademark.corpusSourceId, source.id),
        inArray(trademark.sourceRecordId, sourceRecordIds),
      ),
    );

  const existingByRecordId = new Map(
    existingRows.map((row) => [row.sourceRecordId, row] as const),
  );

  const trademarkIds: string[] = [];
  const toUpsert: typeof mappedRows = [];
  let unchangedCount = 0;

  for (const item of mappedRows) {
    const existing = existingByRecordId.get(item.row.application_number);
    if (existing && existing.sourceHash === item.mapped.trademark.sourceHash) {
      trademarkIds.push(existing.id);
      unchangedCount += 1;
      continue;
    }
    toUpsert.push(item);
  }

  let upsertedCount = 0;

  for (let offset = 0; offset < toUpsert.length; offset += UPSERT_CHUNK) {
    const chunk = toUpsert.slice(offset, offset + UPSERT_CHUNK);
    const values = chunk.map((item) => item.mapped.trademark);

    const upserted = await db
      .insert(trademark)
      .values(values)
      .onConflictDoUpdate({
        target: [trademark.corpusSourceId, trademark.sourceRecordId],
        set: {
          applicationNumber: sql`excluded.application_number`,
          markText: sql`excluded.mark_text`,
          markType: sql`excluded.mark_type`,
          statusCode: sql`excluded.status_code`,
          normalizedStatus: sql`excluded.normalized_status`,
          filingDate: sql`excluded.filing_date`,
          registrationDate: sql`excluded.registration_date`,
          niceClasses: sql`excluded.nice_classes`,
          isTextSearchable: sql`excluded.is_text_searchable`,
          sourceHash: sql`excluded.source_hash`,
          mappingVersion: sql`excluded.mapping_version`,
          mappedAt: sql`excluded.mapped_at`,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: trademark.id,
        sourceRecordId: trademark.sourceRecordId,
      });

    const idByRecord = new Map(
      upserted.map((row) => [row.sourceRecordId, row.id] as const),
    );

    for (const item of chunk) {
      const id = idByRecord.get(item.row.application_number);
      if (!id) {
        throw new Error(`Failed to upsert trademark ${item.row.application_number}`);
      }
      trademarkIds.push(id);
      upsertedCount += 1;
    }

    // Skip trademark_goods_service stubs here — scans use trademark.nice_classes.
    // Placeholder G&S rows were a major write cost for bulk bridge.
  }

  return {
    corpusSourceId: source.id,
    trademarkIds,
    upsertedCount,
    unchangedCount,
  };
}
