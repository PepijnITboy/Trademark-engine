# OSS survey — string metrics

| Library | License | Maintenance | Unicode | Runtime | Perf | Decision |
|---|---|---|---|---|---|---|
| RapidFuzz | MIT | Excellent | Good | Python/C++ | Very high | **Adapt** as oracle / optional sidecar |
| fastest-levenshtein | MIT | Good | JS string units | Node | High (pair) | **Adopt** for Levenshtein baseline + grapheme tests |
| rapid-fuzzy (npm) | MIT | Younger | Broad | Node | High | **Evaluate** in orthographic phase |
| Jellyfish | MIT | Good | Python | Python | Good | **Reference only** (golden tests) |
| Talisman | MIT | Stale | FR-leaning | Node | Medium | **Reject** as dependency |

Interface: `StringMetricEngine` with levenshtein, damerauLevenshtein, jaro, jaroWinkler, lcs — no RapidFuzz types in the comparison core.
