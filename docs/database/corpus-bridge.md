# Corpus bridge — `test_database_europa` → engine schema

## Source (read-only)

Default table: `test_database_europa` (Supabase / Postgres).

**Hard rule:** engine code only **SELECT**s from this table. Never upsert, update, delete, restore, or use it as a scrape target. Writes go only to local engine tables (`trademark`, `trademark_normalized_representation`, …).

| Column | Maps to |
|---|---|
| `application_number` | `trademark.source_record_id` |
| `mark_name` | `trademark.mark_text` |
| `status` | `trademark.status_code` (+ normalized mapping) |
| `nice_classes` | `trademark.nice_classes` + goods stub rows |
| `application_date` | `trademark.filing_date` |
| `registration_date` | `trademark.registration_date` |

## Filter 1 — status allowlist

Only these source statuses are bridged:

| Status | Normalized |
|---|---|
| `REGISTERED` | `registered` |
| `ACCEPTED` | `registered` |

Skipped at SELECT time: `EXPIRED`, `REFUSED`, `CANCELLED`, `SURRENDERED`, `REMOVED_FROM_REGISTER`, `WITHDRAWN`, pending statuses, `null`, etc.

Constant: `BRIDGE_SOURCE_STATUSES` in `@trademark-engine/corpus-bridge`.

## Missing source fields

Treat as unknown (never invent via API):

- owner / applicant name
- full goods & services text
- territories
- markFeature / markKind
- priority / publication / expiry dates
- raw registry payload

`is_text_searchable = true` iff `mark_name` is non-empty after trim.

## Modes

| Mode | Behavior |
|---|---|
| `full_mirror` | Read all allowlist rows (`CORPUS_LIMIT=0`) → upsert canonical |
| `changed` | Upsert where content hash changed; skip unchanged (`source_hash`) |
| `single` | One `application_number` (not wired in CLI yet) |
| `sample` | Dev/test fixtures only — API requires `ALLOW_SAMPLE_BRIDGE=1` |

## CLI

```bash
pnpm corpus:purge-statuses      # drop local trademarks outside filter 1
CORPUS_LIMIT=0 pnpm corpus:bridge  # full allowlist (~804k)
pnpm corpus:preprocess             # required before scans (normalized + phonetic keys)
```

Each Supabase bridge writes a `corpus_bridge_run` row (fetched / upserted / unchanged / filter checkpoint).

## Idempotency

- Unique key: `(corpus_source_id, source_record_id)`
- Content hash: sha256 of mark_name + status + nice_classes + dates
- Remap only when hash changes (unchanged rows skipped)
- Failures logged to `corpus_bridge_failure` (local ETL errors only)

## After bridge

1. Preprocessing fills `trademark_normalized_representation` and `trademark_phonetic_key` (Double Metaphone + NYSIIS). Re-run `pnpm corpus:preprocess` to backfill phonetic keys on an already-normalized corpus.
2. Indexes become queryable
3. Scans read **only** engine tables/indexes — never the live corpus connection for comparison logic
4. Empty searchable → `run corpus:bridge`; searchable but no normalize → `run corpus:preprocess`
