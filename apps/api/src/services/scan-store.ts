import { randomUUID } from "node:crypto";
import {
  buildComparableFromMarkText,
  compareTrademarkPair,
} from "@trademark-engine/comparison";
import { closeDb, createDb, type Database } from "@trademark-engine/database";
import { pickLengthBucketThreshold } from "@trademark-engine/domain";
import { explainFromEvidence } from "@trademark-engine/explanations";
import { normalizeMark } from "@trademark-engine/normalization";
import { stage1Prune } from "@trademark-engine/pruning";
import {
  applyStrategyCap,
  assertEngineCorpusReady,
  buildCoreRetrievalKeys,
  buildPhoneticLookupKeys,
  buildTransliterationLookupKeys,
  countPreCapPhonetic,
  countPreCapTrigram,
  defaultRetrievalProfile,
  EMPTY_BRIDGE_ERROR,
  fetchTrademarkHitsByIds,
  mergeHitsReservingCore,
  retrieveExactCompact,
  retrievePhoneticKeys,
  retrieveTrigramCompact,
  unionCandidates,
  type StrategyResultRow,
} from "@trademark-engine/retrieval";
import { groupIntoFamilies, rankResults, scoreFromFeatures } from "@trademark-engine/risk-engine";
import { tokenizeMark } from "@trademark-engine/token-analysis";
import type { EngineScanResult } from "@trademark-engine/evaluation";
import {
  SCAN_STAGE_DEFINITIONS,
  SCAN_STAGE_WEIGHTS,
  computeEta,
  computePercentComplete,
} from "./compute-eta.js";

export type ScanStatus = "queued" | "running" | "completed" | "failed";

export type ScanStageStatus = "pending" | "running" | "complete" | "failed";

export type ScanMarkStatus = "pending" | "running" | "completed" | "failed";

export interface ScanStage {
  readonly id: string;
  readonly label: string;
  status: ScanStageStatus;
  counts?: Record<string, number>;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ScanInput {
  readonly markText: string;
  readonly markTexts?: readonly string[];
  readonly selectedNiceClasses?: readonly number[];
  readonly goodsServices?: readonly string[];
  readonly relevantLanguages?: readonly string[];
}

export type ScanResultItem = EngineScanResult;

export interface ScanMarkResult {
  readonly markText: string;
  status: ScanMarkStatus;
  results: ScanResultItem[];
  error?: string;
}

export interface ScanRecord {
  readonly id: string;
  status: ScanStatus;
  readonly input: ScanInput;
  readonly markTexts: readonly string[];
  readonly createdAt: Date;
  readonly stages: ScanStage[];
  readonly markResults: ScanMarkResult[];
  currentMarkIndex: number;
  completedAt?: Date;
  results?: ScanResultItem[];
  error?: string;
  message?: string;
}

export interface ScanProgressResponse {
  readonly stages: readonly ScanStage[];
  readonly percentComplete: number;
  readonly elapsedMs: number;
  readonly estimatedRemainingMs: number | null;
  readonly message: string | null;
  readonly marks: readonly {
    markText: string;
    status: ScanMarkStatus;
    resultCount: number;
    error?: string;
  }[];
  readonly currentMarkIndex: number;
  readonly markTotal: number;
}

const MAX_MARKS_PER_SCAN = 10;

const scans = new Map<string, ScanRecord>();
let configuredDatabaseUrl: string | undefined;
let hasConfiguredDatabaseUrl = false;

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function configureScanStore(options: { databaseUrl?: string | undefined }): void {
  configuredDatabaseUrl = options.databaseUrl;
  hasConfiguredDatabaseUrl = true;
}

/** Split / normalize proposed marks; max 10 unique non-empty names. */
export function resolveMarkTexts(input: {
  markText?: string;
  markTexts?: readonly string[];
}): string[] {
  const fromArray = (input.markTexts ?? []).map((part) => part.trim()).filter(Boolean);
  const fromText = (input.markText ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const source = fromArray.length > 0 ? fromArray : fromText;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const mark of source) {
    const key = mark.toLocaleLowerCase("und");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(mark);
    if (unique.length >= MAX_MARKS_PER_SCAN) {
      break;
    }
  }
  return unique;
}

function createInitialStages(): ScanStage[] {
  return SCAN_STAGE_DEFINITIONS.map((stage) => ({
    id: stage.id,
    label: stage.label,
    status: "pending",
  }));
}

function resetStages(scan: ScanRecord): void {
  for (const stage of scan.stages) {
    stage.status = "pending";
    delete stage.counts;
    delete stage.message;
    delete stage.startedAt;
    delete stage.completedAt;
  }
}

function findStage(scan: ScanRecord, stageId: string): ScanStage | undefined {
  return scan.stages.find((stage) => stage.id === stageId);
}

function beginStage(scan: ScanRecord, stageId: string): void {
  const stage = findStage(scan, stageId);
  if (!stage) {
    return;
  }
  stage.status = "running";
  stage.startedAt = new Date();
}

function completeStage(
  scan: ScanRecord,
  stageId: string,
  update?: { counts?: Record<string, number>; message?: string },
): void {
  const stage = findStage(scan, stageId);
  if (!stage) {
    return;
  }
  stage.status = "complete";
  stage.completedAt = new Date();
  if (update?.counts) {
    stage.counts = update.counts;
  }
  if (update?.message) {
    stage.message = update.message;
  }
}

function failStage(scan: ScanRecord, stageId: string, message: string): void {
  const stage = findStage(scan, stageId);
  if (!stage) {
    return;
  }
  stage.status = "failed";
  stage.completedAt = new Date();
  stage.message = message;
}

function stageStatusMap(scan: ScanRecord): Record<string, ScanStageStatus> {
  return Object.fromEntries(scan.stages.map((stage) => [stage.id, stage.status]));
}

export function computeProgress(scan: ScanRecord): ScanProgressResponse {
  const elapsedMs = Date.now() - scan.createdAt.getTime();
  const statuses = stageStatusMap(scan);
  const markTotal = scan.markTexts.length;
  const completedMarks = scan.markResults.filter(
    (item) => item.status === "completed" || item.status === "failed",
  ).length;
  const stagePercent = computePercentComplete(SCAN_STAGE_WEIGHTS, statuses);

  let percentComplete: number;
  if (markTotal <= 1) {
    percentComplete = stagePercent;
  } else {
    const currentContribution =
      scan.status === "running" && completedMarks < markTotal ? stagePercent / 100 : 0;
    percentComplete = Math.min(
      100,
      Math.round(((completedMarks + currentContribution) / markTotal) * 100),
    );
  }

  const stageEta = computeEta(SCAN_STAGE_WEIGHTS, statuses, elapsedMs);
  let estimatedRemainingMs = stageEta;
  if (markTotal > 1 && completedMarks > 0 && elapsedMs > 0) {
    const avgMsPerMark = elapsedMs / completedMarks;
    const remainingMarks =
      markTotal - completedMarks - (scan.status === "running" && completedMarks < markTotal ? 0.5 : 0);
    estimatedRemainingMs = Math.max(0, Math.round(avgMsPerMark * Math.max(0, remainingMarks)));
  }

  return {
    stages: scan.stages,
    percentComplete,
    elapsedMs,
    estimatedRemainingMs,
    message: scan.message ?? scan.error ?? null,
    marks: scan.markResults.map((item) => ({
      markText: item.markText,
      status: item.status,
      resultCount: item.results.length,
      ...(item.error !== undefined ? { error: item.error } : {}),
    })),
    currentMarkIndex: scan.currentMarkIndex,
    markTotal,
  };
}

export function createScan(input: ScanInput): ScanRecord {
  const markTexts = resolveMarkTexts(input);
  if (markTexts.length === 0) {
    throw new Error("At least one mark text is required");
  }

  const id = randomUUID();
  const record: ScanRecord = {
    id,
    status: "queued",
    input: {
      ...input,
      markText: markTexts.join(", "),
      markTexts,
    },
    markTexts,
    createdAt: new Date(),
    stages: createInitialStages(),
    markResults: markTexts.map((markText) => ({
      markText,
      status: "pending",
      results: [],
    })),
    currentMarkIndex: 0,
  };

  scans.set(id, record);
  record.status = "running";

  queueMicrotask(() => {
    void processScan(id);
  });

  return record;
}

async function processOneMark(
  scan: ScanRecord,
  db: Database,
  markText: string,
): Promise<ScanResultItem[]> {
  beginStage(scan, "validate");
  await yieldEventLoop();
  if (!markText.trim()) {
    throw new Error("Mark text is required");
  }
  completeStage(scan, "validate", { counts: { inputLength: markText.length } });
  await yieldEventLoop();

  beginStage(scan, "normalize");
  const normalized = normalizeMark(markText);
  const tokens = tokenizeMark(markText);
  completeStage(scan, "normalize", {
    counts: {
      compactLength: normalized.compact.length,
      tokenCount: tokens.tokens.length,
    },
  });
  await yieldEventLoop();

  const profile = defaultRetrievalProfile();
  const cap = pickLengthBucketThreshold(normalized.compact.length, profile.strategyCaps);
  const baseExactKeys = [
    normalized.compact,
    normalized.caseFolded.replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("und"),
    normalized.diacriticsFolded.replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("und"),
    normalized.asciiFolded.replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("und"),
  ].filter(Boolean);
  const translitKeys = buildTransliterationLookupKeys(markText);
  const coreRetrieval = buildCoreRetrievalKeys(markText);
  const exactKeySet = new Set(baseExactKeys);
  const novelTranslitKeys = translitKeys.filter((key) => key && !exactKeySet.has(key));
  const novelCoreKeys = coreRetrieval.keys.filter(
    (key) => key && !exactKeySet.has(key) && !novelTranslitKeys.includes(key),
  );
  for (const key of novelCoreKeys) {
    exactKeySet.add(key);
  }
  const exactKeys = [...exactKeySet];

  beginStage(scan, "exact_retrieval");
  await yieldEventLoop();
  const exactHits = (
    await Promise.all(exactKeys.map((key) => retrieveExactCompact(db, key, cap)))
  )
    .flat()
    .filter(
      (hit, index, all) =>
        all.findIndex((candidate) => candidate.trademarkId === hit.trademarkId) === index,
    );
  completeStage(scan, "exact_retrieval", {
    counts: {
      preCap: exactHits.length,
      postCap: exactHits.length,
      cap,
      coreKeyCount: novelCoreKeys.length,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "transliteration_retrieval");
  await yieldEventLoop();
  const translitHits = (
    await Promise.all(novelTranslitKeys.map((key) => retrieveExactCompact(db, key, cap)))
  )
    .flat()
    .filter(
      (hit, index, all) =>
        all.findIndex((candidate) => candidate.trademarkId === hit.trademarkId) === index,
    );
  completeStage(scan, "transliteration_retrieval", {
    counts: {
      preCap: translitHits.length,
      postCap: translitHits.length,
      cap,
      keyCount: novelTranslitKeys.length,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "trigram_retrieval");
  await yieldEventLoop();
  // Prefer Latin transliteration keys for trigram when script differs — native
  // non-Latin compact fills pg_trgm with unrelated rows and crowds out real hits.
  const fullTrigramKeys =
    novelTranslitKeys.length > 0 ? [...novelTranslitKeys] : [normalized.compact];
  const coreTrigramKeys = coreRetrieval.keys.filter(
    (key) => key && !fullTrigramKeys.includes(key),
  );
  let trigramPreCap = exactHits.length + translitHits.length;
  try {
    const preCaps = await Promise.all(
      [...fullTrigramKeys, ...coreTrigramKeys].map((key) =>
        countPreCapTrigram(db, key, profile.minTrigramSimilarity),
      ),
    );
    trigramPreCap = preCaps.reduce((sum, count) => sum + count, 0);
  } catch {
    trigramPreCap = exactHits.length + translitHits.length;
    scan.message = "Trigram pre-cap count unavailable; using post-cap count";
  }

  const [fullTrigramHits, coreTrigramHits] = await Promise.all([
    Promise.all(
      fullTrigramKeys.map((key) =>
        retrieveTrigramCompact(db, key, profile.minTrigramSimilarity, cap),
      ),
    ).then((rows) => rows.flat()),
    Promise.all(
      coreTrigramKeys.map((key) =>
        retrieveTrigramCompact(db, key, profile.minTrigramSimilarity, cap),
      ),
    ).then((rows) => rows.flat()),
  ]);
  const trigramHits = mergeHitsReservingCore(fullTrigramHits, coreTrigramHits, cap);
  completeStage(scan, "trigram_retrieval", {
    counts: {
      preCap: trigramPreCap,
      postCap: trigramHits.length,
      cap,
      coreKeyCount: coreTrigramKeys.length,
      coreHitCount: coreTrigramHits.length,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "phonetic_retrieval");
  await yieldEventLoop();
  const phoneticLookup = buildPhoneticLookupKeys(markText);
  let phoneticPreCap = 0;
  try {
    phoneticPreCap = await countPreCapPhonetic(
      db,
      phoneticLookup.keys,
      phoneticLookup.algorithms,
    );
  } catch {
    phoneticPreCap = 0;
    scan.message = "Phonetic pre-cap count unavailable; using post-cap count";
  }
  const phoneticHits = await retrievePhoneticKeys(
    db,
    phoneticLookup.keys,
    phoneticLookup.algorithms,
    cap,
  );
  completeStage(scan, "phonetic_retrieval", {
    counts: {
      preCap: phoneticPreCap,
      postCap: phoneticHits.length,
      cap,
      keyCount: phoneticLookup.keys.length,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "union");
  const exactRows: StrategyResultRow[] = exactHits.map((hit, index) => ({
    trademarkId: hit.trademarkId,
    strategy: "exact_forms",
    rank: index + 1,
    score: hit.score,
  }));
  const translitRows: StrategyResultRow[] = translitHits.map((hit, index) => ({
    trademarkId: hit.trademarkId,
    strategy: "transliteration",
    rank: index + 1,
    score: hit.score,
  }));
  const trigramRows: StrategyResultRow[] = trigramHits.map((hit, index) => ({
    trademarkId: hit.trademarkId,
    strategy: "trigram",
    rank: index + 1,
    score: hit.score,
  }));
  const phoneticRows: StrategyResultRow[] = phoneticHits.map((hit, index) => ({
    trademarkId: hit.trademarkId,
    strategy: "phonetic",
    rank: index + 1,
    score: hit.score,
  }));

  const cappedExact = applyStrategyCap(
    exactRows.map((row) => ({
      trademarkId: row.trademarkId,
      score: row.score,
      evidence: [{ strategy: row.strategy, rank: row.rank, score: row.score }],
    })),
    cap,
  );
  const cappedTranslit = applyStrategyCap(
    translitRows.map((row) => ({
      trademarkId: row.trademarkId,
      score: row.score,
      evidence: [{ strategy: row.strategy, rank: row.rank, score: row.score }],
    })),
    cap,
  );
  const cappedTrigram = applyStrategyCap(
    trigramRows.map((row) => ({
      trademarkId: row.trademarkId,
      score: row.score,
      evidence: [{ strategy: row.strategy, rank: row.rank, score: row.score }],
    })),
    cap,
  );
  const cappedPhonetic = applyStrategyCap(
    phoneticRows.map((row) => ({
      trademarkId: row.trademarkId,
      score: row.score,
      evidence: [{ strategy: row.strategy, rank: row.rank, score: row.score }],
    })),
    cap,
  );

  const unionInput: Record<string, StrategyResultRow[]> = {};
  if (cappedExact.kept.length > 0) {
    unionInput.exact_forms = cappedExact.kept.map((item, index) => ({
      trademarkId: item.trademarkId,
      strategy: "exact_forms",
      rank: index + 1,
      score: item.score,
    }));
  }
  if (cappedTranslit.kept.length > 0) {
    unionInput.transliteration = cappedTranslit.kept.map((item, index) => ({
      trademarkId: item.trademarkId,
      strategy: "transliteration",
      rank: index + 1,
      score: item.score,
    }));
  }
  if (cappedTrigram.kept.length > 0) {
    unionInput.trigram = cappedTrigram.kept.map((item, index) => ({
      trademarkId: item.trademarkId,
      strategy: "trigram",
      rank: index + 1,
      score: item.score,
    }));
  }
  if (cappedPhonetic.kept.length > 0) {
    unionInput.phonetic = cappedPhonetic.kept.map((item, index) => ({
      trademarkId: item.trademarkId,
      strategy: "phonetic",
      rank: index + 1,
      score: item.score,
    }));
  }

  const union = unionCandidates(unionInput);
  completeStage(scan, "union", {
    counts: {
      exact: cappedExact.postCapCount,
      transliteration: cappedTranslit.postCapCount,
      trigram: cappedTrigram.postCapCount,
      phonetic: cappedPhonetic.postCapCount,
      unique: union.length,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "pruning");
  await yieldEventLoop();
  const candidateIds = union.map((entry) => entry.trademarkId);
  const hitMap = await fetchTrademarkHitsByIds(db, candidateIds);
  const proposed = buildComparableFromMarkText(
    markText,
    scan.input.selectedNiceClasses,
  );

  const enriched = union
    .map((entry) => {
      const hit = hitMap.get(entry.trademarkId);
      if (!hit) {
        return null;
      }
      const candidateNorm = normalizeMark(hit.markText);
      const comparison = compareTrademarkPair(
        proposed,
        buildComparableFromMarkText(hit.markText, hit.niceClasses),
        {
          ...(scan.input.selectedNiceClasses !== undefined
            ? { proposedNiceClasses: scan.input.selectedNiceClasses }
            : {}),
          candidateNiceClasses: hit.niceClasses,
        },
      );
      const strategies = entry.evidence.map((item) => item.strategy);
      return {
        id: entry.trademarkId,
        markText: hit.markText,
        niceClasses: hit.niceClasses,
        status: hit.status,
        retrievalFamilies: strategies,
        comparison,
        lengths: {
          proposed: normalized.compact.length,
          candidate: candidateNorm.compact.length,
        },
        features: {
          exactMatch: normalized.compact === candidateNorm.compact,
          phoneticKeyMatch: (comparison.features.phonetic.primaryKeyMatch ?? 0) > 0,
          transliterationExact: (comparison.features.exact.transliterationMatch ?? 0) >= 1,
          trigramDice: comparison.features.orthographic.trigramDice ?? 0,
          prefixScore: comparison.features.token.prefixOverlap ?? 0,
          suffixScore: comparison.features.token.suffixOverlap ?? 0,
          missingData: false,
          coreTokenHit:
            (comparison.features.token.significantOverlap ?? 0) > 0 ||
            (comparison.features.token.coreCompactMatch ?? 0) >= 1 ||
            (comparison.features.token.dominantTokenOverlap ?? 0) >= 1,
          noiseOnlyHit: (comparison.features.token.noiseOnlyOverlap ?? 0) >= 0.5,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const pruneDecisions = stage1Prune(
    enriched.map((item) => ({
      id: item.id,
      features: item.features,
      retrievalFamilies: item.retrievalFamilies,
      lengths: item.lengths,
    })),
  );
  const keptIds = new Set(
    pruneDecisions
      .filter((decision) => decision.decision === "keep" || decision.decision === "promote")
      .map((decision) => decision.id),
  );
  completeStage(scan, "pruning", {
    counts: {
      candidates: enriched.length,
      kept: keptIds.size,
      discarded: enriched.length - keptIds.size,
    },
  });
  await yieldEventLoop();

  beginStage(scan, "comparison");
  await yieldEventLoop();
  const compared = enriched.filter((item) => keptIds.has(item.id));
  completeStage(scan, "comparison", {
    counts: { compared: compared.length },
  });
  await yieldEventLoop();

  beginStage(scan, "scoring");
  await yieldEventLoop();
  const scored = [];
  for (let index = 0; index < compared.length; index += 1) {
    const item = compared[index]!;
    const score = scoreFromFeatures(item.comparison.features);
    const explanations = explainFromEvidence(item.comparison.evidenceCodes, {
      proposedMark: markText,
      candidateMark: item.markText,
    });
    scored.push({
      candidateId: item.id,
      markText: item.markText,
      niceClasses: item.niceClasses,
      status: item.status,
      score,
      evidenceCodes: item.comparison.evidenceCodes,
      explanations,
      features: item.comparison.features,
      retrievalFamilies: item.retrievalFamilies,
      familyMemberCount: 1,
      id: item.id,
      experimentalConflictScore: score.experimentalConflictScore,
      confidence: score.confidence,
      riskBand: score.riskBand,
      independentChannelCount: item.retrievalFamilies.length,
      activeRight: item.status === "registered",
      ownerKey: null,
    });
    if (index > 0 && index % 25 === 0) {
      await yieldEventLoop();
    }
  }

  const families = groupIntoFamilies(rankResults(scored));
  const results = families.map((group) => {
    const rep = group.representative;
    return {
      candidateId: rep.candidateId,
      markText: rep.markText,
      niceClasses: rep.niceClasses,
      status: rep.status,
      score: rep.score,
      evidenceCodes: rep.evidenceCodes,
      explanations: rep.explanations,
      features: rep.features,
      retrievalFamilies: rep.retrievalFamilies,
      familyMemberCount: group.memberCount,
    };
  });
  completeStage(scan, "scoring", {
    counts: { results: results.length },
  });
  await yieldEventLoop();

  beginStage(scan, "complete");
  completeStage(scan, "complete");
  return results;
}

async function processScan(id: string): Promise<void> {
  const scan = scans.get(id);
  if (!scan) {
    return;
  }

  const databaseUrl = hasConfiguredDatabaseUrl
    ? configuredDatabaseUrl
    : process.env.DATABASE_URL;
  if (!databaseUrl) {
    scan.status = "failed";
    scan.error = EMPTY_BRIDGE_ERROR;
    scan.message = EMPTY_BRIDGE_ERROR;
    scan.completedAt = new Date();
    failStage(scan, "validate", EMPTY_BRIDGE_ERROR);
    for (const markResult of scan.markResults) {
      markResult.status = "failed";
      markResult.error = EMPTY_BRIDGE_ERROR;
    }
    return;
  }

  const db = createDb(databaseUrl);

  try {
    const ready = await assertEngineCorpusReady(db);
    scan.message = `Corpus ready: ${ready.searchable} searchable, ${ready.normalized} normalized`;

    for (let index = 0; index < scan.markTexts.length; index += 1) {
      const markText = scan.markTexts[index]!;
      const markResult = scan.markResults[index]!;
      scan.currentMarkIndex = index;
      markResult.status = "running";
      resetStages(scan);
      scan.message =
        scan.markTexts.length > 1
          ? `Scanning ${index + 1}/${scan.markTexts.length}: ${markText}`
          : `Corpus ready: ${ready.searchable} searchable, ${ready.normalized} normalized`;

      try {
        const results = await processOneMark(scan, db, markText);
        markResult.results = results;
        markResult.status = "completed";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scan failed";
        markResult.status = "failed";
        markResult.error = message;
        const runningStage = scan.stages.find((stage) => stage.status === "running");
        if (runningStage) {
          failStage(scan, runningStage.id, message);
        }
      }
    }

    const allFailed = scan.markResults.every((item) => item.status === "failed");
    scan.results = scan.markResults.flatMap((item) => item.results);
    scan.status = allFailed ? "failed" : "completed";
    if (allFailed) {
      scan.error = scan.markResults.map((item) => item.error).filter(Boolean).join("; ");
      scan.message = scan.error;
    } else if (scan.markTexts.length > 1) {
      scan.message = `Completed ${scan.markResults.filter((item) => item.status === "completed").length}/${scan.markTexts.length} marks`;
    } else {
      delete scan.message;
    }
    scan.completedAt = new Date();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    scan.status = "failed";
    scan.error = message;
    scan.message = message;
    scan.completedAt = new Date();

    const runningStage = scan.stages.find((stage) => stage.status === "running");
    if (runningStage) {
      failStage(scan, runningStage.id, message);
    }
    for (const markResult of scan.markResults) {
      if (markResult.status === "pending" || markResult.status === "running") {
        markResult.status = "failed";
        markResult.error = message;
      }
    }
  } finally {
    await closeDb(db);
  }
}

export function getScan(id: string): ScanRecord | undefined {
  return scans.get(id);
}

export function getScanProgress(id: string): ScanProgressResponse | undefined {
  const scan = scans.get(id);
  if (!scan) {
    return undefined;
  }
  return computeProgress(scan);
}

export function getScanResults(id: string): ScanResultItem[] | undefined {
  const scan = scans.get(id);
  if (!scan || scan.status !== "completed" || !scan.results) {
    return undefined;
  }
  return scan.results;
}

export function getScanMarkResults(id: string): ScanMarkResult[] | undefined {
  const scan = scans.get(id);
  if (!scan || scan.status !== "completed") {
    return undefined;
  }
  return scan.markResults;
}

export function clearScanStore(): void {
  scans.clear();
  configuredDatabaseUrl = undefined;
  hasConfiguredDatabaseUrl = false;
}
