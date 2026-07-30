import {
  candidatePruningDecision,
  closeDb,
  createDb,
  trademark,
  trademarkGoodsService,
  trademarkNormalizedRepresentation,
  trademarkPhoneticKey,
  trademarkPronunciation,
  trademarkRetrievalEvidence,
  trademarkScanCandidate,
  type Database,
} from "@trademark-engine/database";
import { inArray, notInArray } from "drizzle-orm";
import { BRIDGE_SOURCE_STATUSES } from "./normalize-status.js";

export interface PurgeNonAllowlistResult {
  readonly deletedTrademarks: number;
}

/**
 * Remove engine trademarks whose source status is outside filter 1
 * (REGISTERED / ACCEPTED). Deletes dependent rows first (no ON DELETE CASCADE).
 */
export async function purgeNonAllowlistTrademarks(
  db: Database,
): Promise<PurgeNonAllowlistResult> {
  const allowlist = [...BRIDGE_SOURCE_STATUSES];

  const excluded = await db
    .select({ id: trademark.id })
    .from(trademark)
    .where(notInArray(trademark.statusCode, allowlist));

  const ids = excluded.map((row) => row.id);
  if (ids.length === 0) {
    return { deletedTrademarks: 0 };
  }

  const batchSize = 500;
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const batch = ids.slice(offset, offset + batchSize);

    await db
      .delete(trademarkGoodsService)
      .where(inArray(trademarkGoodsService.trademarkId, batch));
    await db
      .delete(trademarkNormalizedRepresentation)
      .where(inArray(trademarkNormalizedRepresentation.trademarkId, batch));
    await db
      .delete(trademarkPronunciation)
      .where(inArray(trademarkPronunciation.trademarkId, batch));
    await db
      .delete(trademarkPhoneticKey)
      .where(inArray(trademarkPhoneticKey.trademarkId, batch));
    await db
      .delete(trademarkRetrievalEvidence)
      .where(inArray(trademarkRetrievalEvidence.candidateTrademarkId, batch));
    await db
      .delete(candidatePruningDecision)
      .where(inArray(candidatePruningDecision.candidateTrademarkId, batch));
    await db
      .delete(trademarkScanCandidate)
      .where(inArray(trademarkScanCandidate.trademarkId, batch));
    await db.delete(trademark).where(inArray(trademark.id, batch));
  }

  return { deletedTrademarks: ids.length };
}

export async function purgeNonAllowlistFromDatabaseUrl(
  databaseUrl: string,
): Promise<PurgeNonAllowlistResult> {
  const db = createDb(databaseUrl);
  try {
    return await purgeNonAllowlistTrademarks(db);
  } finally {
    await closeDb(db);
  }
}
