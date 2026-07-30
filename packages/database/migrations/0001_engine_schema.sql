-- Engine database schema (not registry API tables)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE corpus_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trademark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_source_id uuid NOT NULL REFERENCES corpus_source (id),
  source_record_id text NOT NULL,
  application_number text,
  mark_text text NOT NULL,
  mark_type text NOT NULL DEFAULT 'word',
  status_code text NOT NULL,
  normalized_status text NOT NULL,
  filing_date timestamptz,
  registration_date timestamptz,
  nice_classes integer[] NOT NULL DEFAULT '{}',
  territories text[] NOT NULL DEFAULT '{}',
  source_languages text[] NOT NULL DEFAULT '{}',
  is_text_searchable boolean NOT NULL,
  source_hash text NOT NULL,
  mapping_version text NOT NULL,
  mapped_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trademark_corpus_source_source_record_id_unique
    UNIQUE (corpus_source_id, source_record_id)
);

CREATE TABLE trademark_goods_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trademark_id uuid NOT NULL REFERENCES trademark (id),
  nice_class integer,
  language text NOT NULL,
  original_text text NOT NULL,
  normalized_text text NOT NULL,
  normalized_tokens text[] NOT NULL DEFAULT '{}',
  concept_ids text[] NOT NULL DEFAULT '{}',
  structuring_status text NOT NULL DEFAULT 'unprocessed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trademark_normalized_representation (
  trademark_id uuid PRIMARY KEY REFERENCES trademark (id),
  raw text NOT NULL,
  unicode_nfc text NOT NULL,
  unicode_nfkc text NOT NULL,
  case_folded text NOT NULL,
  diacritics_folded text NOT NULL,
  punctuation_folded text NOT NULL,
  whitespace_folded text NOT NULL,
  ascii_folded text NOT NULL,
  compact text NOT NULL,
  tokens text[] NOT NULL DEFAULT '{}',
  significant_tokens text[] NOT NULL DEFAULT '{}',
  weak_tokens text[] NOT NULL DEFAULT '{}',
  descriptive_tokens text[] NOT NULL DEFAULT '{}',
  company_suffix_tokens text[] NOT NULL DEFAULT '{}',
  dominant_token text,
  prefixes text[] NOT NULL DEFAULT '{}',
  suffixes text[] NOT NULL DEFAULT '{}',
  bigrams text[] NOT NULL DEFAULT '{}',
  trigrams text[] NOT NULL DEFAULT '{}',
  consonant_skeletons text[] NOT NULL DEFAULT '{}',
  transliterations jsonb NOT NULL DEFAULT '[]',
  language_hypotheses jsonb NOT NULL DEFAULT '[]',
  scripts text[] NOT NULL DEFAULT '{}',
  normalization_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trademark_pronunciation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trademark_id uuid NOT NULL REFERENCES trademark (id),
  locale text NOT NULL,
  source text NOT NULL,
  algorithm_version text NOT NULL,
  phonetic_keys text[] NOT NULL DEFAULT '{}',
  ipa text,
  phonemes text[] NOT NULL DEFAULT '{}',
  sound_units text[] NOT NULL DEFAULT '{}',
  consonant_skeleton text,
  vowel_pattern text,
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trademark_phonetic_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trademark_id uuid NOT NULL REFERENCES trademark (id),
  locale text NOT NULL,
  algorithm text NOT NULL,
  key text NOT NULL,
  CONSTRAINT trademark_phonetic_key_unique
    UNIQUE (trademark_id, locale, algorithm, key)
);

CREATE TABLE corpus_bridge_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  status text NOT NULL,
  records_read integer NOT NULL DEFAULT 0,
  records_upserted integer NOT NULL DEFAULT 0,
  records_unchanged integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  checkpoint jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE corpus_bridge_failure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES corpus_bridge_run (id),
  source_record_id text NOT NULL,
  error_code text NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preprocessing_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_version text NOT NULL,
  phonetic_version text NOT NULL,
  token_version text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  checkpoint jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE database_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_run_id uuid REFERENCES corpus_bridge_run (id),
  preprocessing_run_id uuid REFERENCES preprocessing_run (id),
  normalization_version text NOT NULL,
  phonetic_version text NOT NULL,
  goods_taxonomy_version text NOT NULL,
  searchable_record_count integer NOT NULL,
  total_record_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trademark_scan_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input jsonb NOT NULL,
  input_hash text NOT NULL,
  database_snapshot_id uuid NOT NULL REFERENCES database_snapshot (id),
  status text NOT NULL,
  candidates_by_strategy jsonb NOT NULL DEFAULT '{}',
  unique_candidate_count integer NOT NULL DEFAULT 0,
  stage1_compared_count integer NOT NULL DEFAULT 0,
  stage2_compared_count integer NOT NULL DEFAULT 0,
  discarded_candidate_count integer NOT NULL DEFAULT 0,
  final_result_count integer NOT NULL DEFAULT 0,
  engine_version text NOT NULL,
  retrieval_profile_version text NOT NULL,
  pruning_profile_version text NOT NULL,
  score_version text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  error text
);

CREATE TABLE trademark_scan_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES trademark_scan_run (id),
  trademark_id uuid NOT NULL REFERENCES trademark (id),
  retrieval_strategy_count integer NOT NULL,
  strongest_retrieval_score real,
  current_stage text NOT NULL,
  decision text NOT NULL,
  final_score real,
  rank integer,
  feature_vector jsonb,
  timings jsonb,
  CONSTRAINT trademark_scan_candidate_scan_trademark_unique
    UNIQUE (scan_id, trademark_id)
);

CREATE TABLE trademark_retrieval_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES trademark_scan_run (id),
  candidate_trademark_id uuid NOT NULL REFERENCES trademark (id),
  strategy text NOT NULL,
  query_representation text NOT NULL,
  candidate_representation text NOT NULL,
  raw_score real NOT NULL,
  rank_within_strategy integer NOT NULL,
  locale text,
  algorithm text,
  rule_id text,
  profile_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE candidate_pruning_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES trademark_scan_run (id),
  candidate_trademark_id uuid NOT NULL REFERENCES trademark (id),
  stage text NOT NULL,
  decision text NOT NULL,
  rule_ids text[] NOT NULL DEFAULT '{}',
  measured_features jsonb,
  protected_by text[] NOT NULL DEFAULT '{}',
  confidence real,
  pruning_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX trademark_normalized_representation_compact_idx
  ON trademark_normalized_representation (compact);

CREATE INDEX trademark_normalized_representation_diacritics_folded_idx
  ON trademark_normalized_representation (diacritics_folded);

CREATE INDEX trademark_normalized_representation_compact_trgm_idx
  ON trademark_normalized_representation
  USING gin (compact gin_trgm_ops);

CREATE INDEX trademark_normalized_representation_whitespace_folded_trgm_idx
  ON trademark_normalized_representation
  USING gin (whitespace_folded gin_trgm_ops);

CREATE INDEX trademark_normalized_representation_tokens_gin_idx
  ON trademark_normalized_representation
  USING gin (tokens);

CREATE INDEX trademark_normalized_representation_significant_tokens_gin_idx
  ON trademark_normalized_representation
  USING gin (significant_tokens);

CREATE INDEX trademark_normalized_representation_prefixes_gin_idx
  ON trademark_normalized_representation
  USING gin (prefixes);

CREATE INDEX trademark_normalized_representation_suffixes_gin_idx
  ON trademark_normalized_representation
  USING gin (suffixes);

CREATE INDEX trademark_normalized_representation_consonant_skeletons_gin_idx
  ON trademark_normalized_representation
  USING gin (consonant_skeletons);

CREATE INDEX trademark_nice_classes_gin_idx
  ON trademark
  USING gin (nice_classes);

CREATE INDEX trademark_phonetic_key_locale_algorithm_key_idx
  ON trademark_phonetic_key (locale, algorithm, key);

CREATE INDEX trademark_is_text_searchable_partial_idx
  ON trademark (id)
  WHERE is_text_searchable = true;
