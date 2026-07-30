import {
  trademark,
  trademarkNormalizedRepresentation,
  trademarkPhoneticKey,
  type Database,
} from "@trademark-engine/database";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface RetrievalHit {
  readonly trademarkId: string;
  readonly score: number;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly status: string;
}

function mapHit(row: {
  trademark_id: string;
  score: number | string;
  mark_text: string;
  nice_classes: number[] | null;
  status: string;
}): RetrievalHit {
  return {
    trademarkId: row.trademark_id,
    score: Number(row.score),
    markText: row.mark_text,
    niceClasses: row.nice_classes ?? [],
    status: row.status,
  };
}

export async function retrieveExactCompact(
  db: Database,
  compact: string,
  cap: number,
): Promise<RetrievalHit[]> {
  const rows = await db.execute<{
    trademark_id: string;
    score: number;
    mark_text: string;
    nice_classes: number[] | null;
    status: string;
  }>(sql`
    SELECT
      t.id AS trademark_id,
      1.0::float AS score,
      t.mark_text,
      t.nice_classes,
      t.normalized_status AS status
    FROM ${trademark} t
    INNER JOIN ${trademarkNormalizedRepresentation} tnr
      ON tnr.trademark_id = t.id
    WHERE t.is_text_searchable = true
      AND (
        tnr.compact = ${compact}
        OR tnr.case_folded = ${compact}
        OR tnr.diacritics_folded = ${compact}
        OR tnr.ascii_folded = ${compact}
      )
    ORDER BY t.mark_text ASC
    LIMIT ${cap}
  `);

  return rows.map(mapHit);
}

export async function retrieveTrigramCompact(
  db: Database,
  compact: string,
  minSim: number,
  cap: number,
): Promise<RetrievalHit[]> {
  const rows = await db.execute<{
    trademark_id: string;
    score: number;
    mark_text: string;
    nice_classes: number[] | null;
    status: string;
  }>(sql`
    SELECT
      t.id AS trademark_id,
      similarity(tnr.compact, ${compact}) AS score,
      t.mark_text,
      t.nice_classes,
      t.normalized_status AS status
    FROM ${trademark} t
    INNER JOIN ${trademarkNormalizedRepresentation} tnr
      ON tnr.trademark_id = t.id
    WHERE t.is_text_searchable = true
      AND tnr.compact IS NOT NULL
      AND tnr.compact % ${compact}
      AND similarity(tnr.compact, ${compact}) >= ${minSim}
    ORDER BY score DESC
    LIMIT ${cap}
  `);

  return rows.map(mapHit);
}

export async function retrievePhoneticKeys(
  db: Database,
  keys: readonly string[],
  algorithms: readonly string[],
  cap: number,
): Promise<RetrievalHit[]> {
  if (keys.length === 0 || algorithms.length === 0 || cap <= 0) {
    return [];
  }

  const keyList = sql.join(
    keys.map((key) => sql`${key}`),
    sql`, `,
  );
  const algorithmList = sql.join(
    algorithms.map((algorithm) => sql`${algorithm}`),
    sql`, `,
  );

  const rows = await db.execute<{
    trademark_id: string;
    score: number;
    mark_text: string;
    nice_classes: number[] | null;
    status: string;
  }>(sql`
    SELECT
      t.id AS trademark_id,
      1.0::float AS score,
      t.mark_text,
      t.nice_classes,
      t.normalized_status AS status
    FROM ${trademark} t
    INNER JOIN ${trademarkPhoneticKey} tpk
      ON tpk.trademark_id = t.id
    WHERE t.is_text_searchable = true
      AND tpk.key IN (${keyList})
      AND tpk.algorithm IN (${algorithmList})
      AND tpk.algorithm <> 'unencodable'
    GROUP BY t.id, t.mark_text, t.nice_classes, t.normalized_status
    ORDER BY t.mark_text ASC
    LIMIT ${cap}
  `);

  return rows.map(mapHit);
}

export async function countPreCapTrigram(
  db: Database,
  compact: string,
  minSim: number,
): Promise<number> {
  const rows = await db.execute<{ count: number | string }>(sql`
    SELECT COUNT(*)::int AS count
    FROM ${trademark} t
    INNER JOIN ${trademarkNormalizedRepresentation} tnr
      ON tnr.trademark_id = t.id
    WHERE t.is_text_searchable = true
      AND tnr.compact IS NOT NULL
      AND tnr.compact % ${compact}
      AND similarity(tnr.compact, ${compact}) >= ${minSim}
  `);

  const first = rows[0];
  return first ? Number(first.count) : 0;
}

export async function countPreCapPhonetic(
  db: Database,
  keys: readonly string[],
  algorithms: readonly string[],
): Promise<number> {
  if (keys.length === 0 || algorithms.length === 0) {
    return 0;
  }

  const keyList = sql.join(
    keys.map((key) => sql`${key}`),
    sql`, `,
  );
  const algorithmList = sql.join(
    algorithms.map((algorithm) => sql`${algorithm}`),
    sql`, `,
  );

  const rows = await db.execute<{ count: number | string }>(sql`
    SELECT COUNT(DISTINCT t.id)::int AS count
    FROM ${trademark} t
    INNER JOIN ${trademarkPhoneticKey} tpk
      ON tpk.trademark_id = t.id
    WHERE t.is_text_searchable = true
      AND tpk.key IN (${keyList})
      AND tpk.algorithm IN (${algorithmList})
      AND tpk.algorithm <> 'unencodable'
  `);

  const first = rows[0];
  return first ? Number(first.count) : 0;
}

export async function countSearchableTrademarks(db: Database): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trademark)
    .where(eq(trademark.isTextSearchable, true));

  return rows[0]?.count ?? 0;
}

export async function countNormalizedTrademarks(db: Database): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trademarkNormalizedRepresentation);

  return rows[0]?.count ?? 0;
}

export const EMPTY_BRIDGE_ERROR = "Engine database empty; run corpus:bridge-100k";
export const EMPTY_PREPROCESS_ERROR =
  "Engine indexes empty; run corpus:preprocess-100k";

export class EngineCorpusNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineCorpusNotReadyError";
  }
}

export async function assertEngineCorpusReady(
  db: Database,
): Promise<{ searchable: number; normalized: number }> {
  const searchable = await countSearchableTrademarks(db);
  if (searchable === 0) {
    throw new EngineCorpusNotReadyError(EMPTY_BRIDGE_ERROR);
  }

  const normalized = await countNormalizedTrademarks(db);
  if (normalized === 0) {
    throw new EngineCorpusNotReadyError(EMPTY_PREPROCESS_ERROR);
  }

  return { searchable, normalized };
}

export async function fetchTrademarkHitsByIds(
  db: Database,
  ids: readonly string[],
): Promise<Map<string, RetrievalHit>> {
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      trademarkId: trademark.id,
      markText: trademark.markText,
      niceClasses: trademark.niceClasses,
      status: trademark.normalizedStatus,
    })
    .from(trademark)
    .where(
      and(eq(trademark.isTextSearchable, true), inArray(trademark.id, [...ids])),
    );

  const hits = new Map<string, RetrievalHit>();
  for (const row of rows) {
    hits.set(row.trademarkId, {
      trademarkId: row.trademarkId,
      score: 0,
      markText: row.markText,
      niceClasses: row.niceClasses,
      status: row.status,
    });
  }

  return hits;
}
