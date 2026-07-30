# Algorithms overview

| Package | Role |
|---|---|
| `@trademark-engine/normalization` | Unicode NFC/NFKC, folds, compact, scripts |
| `@trademark-engine/transliteration` | Cyrillic/Greek → Latin variants |
| `@trademark-engine/token-analysis` | Tokens, weak/descriptive, company suffixes, dominance |
| `@trademark-engine/phonetics` | Double Metaphone, Cologne, NYSIIS, Dutch key, skeleton |
| `@trademark-engine/string-metrics` | Levenshtein, Damerau, Jaro, Jaro-Winkler, LCS |
| `@trademark-engine/weighted-edit` | Locale-aware DP edit with rule evidence |
| `@trademark-engine/ngrams` | Char n-grams, Dice/Jaccard |
| `@trademark-engine/retrieval` | Profiles, SQL builders, union, caps |
| `@trademark-engine/pruning` | Stage-1 protect/discard/promote |
| `@trademark-engine/comparison` | Pure pair comparison → feature vector |
| `@trademark-engine/goods-services` | Nice overlap; missing text = unknown |
| `@trademark-engine/risk-engine` | Rule score, bands, ranking, family grouping |
| `@trademark-engine/explanations` | Deterministic evidence templates |
| `@trademark-engine/evaluation` | Recall metrics + in-memory logical scan orchestrator |

See ADRs under `docs/decisions/` and OSS notes under `docs/opensource/`.
