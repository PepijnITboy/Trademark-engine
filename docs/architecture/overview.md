# Trademark Engine — Architecture Overview

## Problem

Given a proposed word mark, which marks in our **already filled local database** may conflict, through which retrieval channels were they found, what similarities/differences exist, and how strong is the **experimental conflict signal**?

## Non-goals

- No live registry/EUIPO API
- No scrape / OAuth / import product
- No AI, embeddings, or generative scoring
- No image/logo similarity
- No commercial SaaS features

## Data flow

```
Filled corpus DB (test_database_europa, read-only)
        ↓ corpus bridge (DB→DB ETL)
Engine PostgreSQL (canonical trademarks)
        ↓ preprocessing workers
Normalized / translit / token / phonetic representations + indexes
        ↓ parallel retrieval strategies (full-corpus indexes)
Candidate union + evidence
        ↓ cheap features → safe pruning
Staged orthographic / phonetic / goods comparison
        ↓ feature vector → rule-based score
Family grouping → top results → deterministic explanations
        ↓
Dashboard / scan API
```

## Scan semantics

- **Logical full-corpus scan** (production): every searchable record is indexed; every active strategy searches its full index; caps apply only after per-strategy ranking.
- **Exhaustive pairwise scan** (benchmarks only): compare query to every record with heavy metrics.

Never call a normal scan a “sample scan”.

## Package dependency direction

```
domain
  ↑
normalization / transliteration / phonetics / string-metrics / ngrams / token-analysis / language-hypotheses
  ↑
retrieval / pruning / goods-services / comparison / corpus-bridge
  ↑
risk-engine / explanations / evaluation
  ↑
apps (api, worker, dashboard)
```

`domain` must not import infrastructure packages.

## Engine versions

Every scan stores: engine version, normalization version, retrieval profile version, pruning profile version, score version, and a `database_snapshot` (record counts + last bridge/preprocess runs).

## Score naming

Output is always an **experimental conflict score** with a risk band and separate confidence. It is not a refusal probability or legal conclusion.
