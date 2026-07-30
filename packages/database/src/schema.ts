import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const corpusSource = pgTable("corpus_source", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const trademark = pgTable(
  "trademark",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corpusSourceId: uuid("corpus_source_id")
      .notNull()
      .references(() => corpusSource.id),
    sourceRecordId: text("source_record_id").notNull(),
    applicationNumber: text("application_number"),
    markText: text("mark_text").notNull(),
    markType: text("mark_type").notNull().default("word"),
    statusCode: text("status_code").notNull(),
    normalizedStatus: text("normalized_status").notNull(),
    filingDate: timestamptz("filing_date"),
    registrationDate: timestamptz("registration_date"),
    niceClasses: integer("nice_classes").array().notNull().default([]),
    territories: text("territories").array().notNull().default([]),
    sourceLanguages: text("source_languages").array().notNull().default([]),
    isTextSearchable: boolean("is_text_searchable").notNull(),
    sourceHash: text("source_hash").notNull(),
    mappingVersion: text("mapping_version").notNull(),
    mappedAt: timestamptz("mapped_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("trademark_corpus_source_source_record_id_unique").on(
      table.corpusSourceId,
      table.sourceRecordId,
    ),
  ],
);

export const trademarkGoodsService = pgTable("trademark_goods_service", {
  id: uuid("id").primaryKey().defaultRandom(),
  trademarkId: uuid("trademark_id")
    .notNull()
    .references(() => trademark.id),
  niceClass: integer("nice_class"),
  language: text("language").notNull(),
  originalText: text("original_text").notNull(),
  normalizedText: text("normalized_text").notNull(),
  normalizedTokens: text("normalized_tokens").array().notNull().default([]),
  conceptIds: text("concept_ids").array().notNull().default([]),
  structuringStatus: text("structuring_status").notNull().default("unprocessed"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const trademarkNormalizedRepresentation = pgTable(
  "trademark_normalized_representation",
  {
    trademarkId: uuid("trademark_id")
      .primaryKey()
      .references(() => trademark.id),
    raw: text("raw").notNull(),
    unicodeNfc: text("unicode_nfc").notNull(),
    unicodeNfkc: text("unicode_nfkc").notNull(),
    caseFolded: text("case_folded").notNull(),
    diacriticsFolded: text("diacritics_folded").notNull(),
    punctuationFolded: text("punctuation_folded").notNull(),
    whitespaceFolded: text("whitespace_folded").notNull(),
    asciiFolded: text("ascii_folded").notNull(),
    compact: text("compact").notNull(),
    tokens: text("tokens").array().notNull().default([]),
    significantTokens: text("significant_tokens").array().notNull().default([]),
    weakTokens: text("weak_tokens").array().notNull().default([]),
    descriptiveTokens: text("descriptive_tokens").array().notNull().default([]),
    companySuffixTokens: text("company_suffix_tokens")
      .array()
      .notNull()
      .default([]),
    dominantToken: text("dominant_token"),
    prefixes: text("prefixes").array().notNull().default([]),
    suffixes: text("suffixes").array().notNull().default([]),
    bigrams: text("bigrams").array().notNull().default([]),
    trigrams: text("trigrams").array().notNull().default([]),
    consonantSkeletons: text("consonant_skeletons").array().notNull().default([]),
    transliterations: jsonb("transliterations").notNull().default([]),
    languageHypotheses: jsonb("language_hypotheses").notNull().default([]),
    scripts: text("scripts").array().notNull().default([]),
    normalizationVersion: text("normalization_version").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
);

export const trademarkPronunciation = pgTable("trademark_pronunciation", {
  id: uuid("id").primaryKey().defaultRandom(),
  trademarkId: uuid("trademark_id")
    .notNull()
    .references(() => trademark.id),
  locale: text("locale").notNull(),
  source: text("source").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  phoneticKeys: text("phonetic_keys").array().notNull().default([]),
  ipa: text("ipa"),
  phonemes: text("phonemes").array().notNull().default([]),
  soundUnits: text("sound_units").array().notNull().default([]),
  consonantSkeleton: text("consonant_skeleton"),
  vowelPattern: text("vowel_pattern"),
  confidence: real("confidence"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const trademarkPhoneticKey = pgTable(
  "trademark_phonetic_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trademarkId: uuid("trademark_id")
      .notNull()
      .references(() => trademark.id),
    locale: text("locale").notNull(),
    algorithm: text("algorithm").notNull(),
    key: text("key").notNull(),
  },
  (table) => [
    unique("trademark_phonetic_key_unique").on(
      table.trademarkId,
      table.locale,
      table.algorithm,
      table.key,
    ),
  ],
);

export const corpusBridgeRun = pgTable("corpus_bridge_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  recordsRead: integer("records_read").notNull().default(0),
  recordsUpserted: integer("records_upserted").notNull().default(0),
  recordsUnchanged: integer("records_unchanged").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  checkpoint: jsonb("checkpoint"),
  startedAt: timestamptz("started_at").notNull(),
  completedAt: timestamptz("completed_at"),
  error: text("error"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const corpusBridgeFailure = pgTable("corpus_bridge_failure", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => corpusBridgeRun.id),
  sourceRecordId: text("source_record_id").notNull(),
  errorCode: text("error_code").notNull(),
  errorMessage: text("error_message").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const preprocessingRun = pgTable("preprocessing_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  normalizationVersion: text("normalization_version").notNull(),
  phoneticVersion: text("phonetic_version").notNull(),
  tokenVersion: text("token_version").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  processed: integer("processed").notNull().default(0),
  succeeded: integer("succeeded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  checkpoint: jsonb("checkpoint"),
  startedAt: timestamptz("started_at").notNull(),
  completedAt: timestamptz("completed_at"),
});

export const databaseSnapshot = pgTable("database_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  bridgeRunId: uuid("bridge_run_id").references(() => corpusBridgeRun.id),
  preprocessingRunId: uuid("preprocessing_run_id").references(
    () => preprocessingRun.id,
  ),
  normalizationVersion: text("normalization_version").notNull(),
  phoneticVersion: text("phonetic_version").notNull(),
  goodsTaxonomyVersion: text("goods_taxonomy_version").notNull(),
  searchableRecordCount: integer("searchable_record_count").notNull(),
  totalRecordCount: integer("total_record_count").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const trademarkScanRun = pgTable("trademark_scan_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  input: jsonb("input").notNull(),
  inputHash: text("input_hash").notNull(),
  databaseSnapshotId: uuid("database_snapshot_id")
    .notNull()
    .references(() => databaseSnapshot.id),
  status: text("status").notNull(),
  candidatesByStrategy: jsonb("candidates_by_strategy").notNull().default({}),
  uniqueCandidateCount: integer("unique_candidate_count").notNull().default(0),
  stage1ComparedCount: integer("stage1_compared_count").notNull().default(0),
  stage2ComparedCount: integer("stage2_compared_count").notNull().default(0),
  discardedCandidateCount: integer("discarded_candidate_count")
    .notNull()
    .default(0),
  finalResultCount: integer("final_result_count").notNull().default(0),
  engineVersion: text("engine_version").notNull(),
  retrievalProfileVersion: text("retrieval_profile_version").notNull(),
  pruningProfileVersion: text("pruning_profile_version").notNull(),
  scoreVersion: text("score_version").notNull(),
  warnings: jsonb("warnings").notNull().default([]),
  startedAt: timestamptz("started_at").notNull(),
  completedAt: timestamptz("completed_at"),
  error: text("error"),
});

export const trademarkScanCandidate = pgTable(
  "trademark_scan_candidate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => trademarkScanRun.id),
    trademarkId: uuid("trademark_id")
      .notNull()
      .references(() => trademark.id),
    retrievalStrategyCount: integer("retrieval_strategy_count").notNull(),
    strongestRetrievalScore: real("strongest_retrieval_score"),
    currentStage: text("current_stage").notNull(),
    decision: text("decision").notNull(),
    finalScore: real("final_score"),
    rank: integer("rank"),
    featureVector: jsonb("feature_vector"),
    timings: jsonb("timings"),
  },
  (table) => [
    unique("trademark_scan_candidate_scan_trademark_unique").on(
      table.scanId,
      table.trademarkId,
    ),
  ],
);

export const trademarkRetrievalEvidence = pgTable("trademark_retrieval_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => trademarkScanRun.id),
  candidateTrademarkId: uuid("candidate_trademark_id")
    .notNull()
    .references(() => trademark.id),
  strategy: text("strategy").notNull(),
  queryRepresentation: text("query_representation").notNull(),
  candidateRepresentation: text("candidate_representation").notNull(),
  rawScore: real("raw_score").notNull(),
  rankWithinStrategy: integer("rank_within_strategy").notNull(),
  locale: text("locale"),
  algorithm: text("algorithm"),
  ruleId: text("rule_id"),
  profileVersion: text("profile_version"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const candidatePruningDecision = pgTable("candidate_pruning_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => trademarkScanRun.id),
  candidateTrademarkId: uuid("candidate_trademark_id")
    .notNull()
    .references(() => trademark.id),
  stage: text("stage").notNull(),
  decision: text("decision").notNull(),
  ruleIds: text("rule_ids").array().notNull().default([]),
  measuredFeatures: jsonb("measured_features"),
  protectedBy: text("protected_by").array().notNull().default([]),
  confidence: real("confidence"),
  pruningVersion: text("pruning_version").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const corpusSourceRelations = relations(corpusSource, ({ many }) => ({
  trademarks: many(trademark),
}));

export const trademarkRelations = relations(trademark, ({ one, many }) => ({
  corpusSource: one(corpusSource, {
    fields: [trademark.corpusSourceId],
    references: [corpusSource.id],
  }),
  goodsServices: many(trademarkGoodsService),
  normalizedRepresentation: one(trademarkNormalizedRepresentation, {
    fields: [trademark.id],
    references: [trademarkNormalizedRepresentation.trademarkId],
  }),
  pronunciations: many(trademarkPronunciation),
  phoneticKeys: many(trademarkPhoneticKey),
}));

export const schema = {
  corpusSource,
  trademark,
  trademarkGoodsService,
  trademarkNormalizedRepresentation,
  trademarkPronunciation,
  trademarkPhoneticKey,
  corpusBridgeRun,
  corpusBridgeFailure,
  preprocessingRun,
  databaseSnapshot,
  trademarkScanRun,
  trademarkScanCandidate,
  trademarkRetrievalEvidence,
  candidatePruningDecision,
};

export type CorpusSource = typeof corpusSource.$inferSelect;
export type Trademark = typeof trademark.$inferSelect;
export type TrademarkInsert = typeof trademark.$inferInsert;
