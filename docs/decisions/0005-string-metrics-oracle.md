# ADR 0005 — String metrics adapter + RapidFuzz oracle

## Status

Accepted

## Context

We need Levenshtein, Damerau, Jaro, Jaro-Winkler, LCS with Unicode-safe behavior and measurable correctness.

## Decision

Expose `StringMetricEngine` in `@trademark-engine/string-metrics`. Ship a TypeScript implementation first (`fastest-levenshtein` + pure TS for other metrics). Use RapidFuzz as an optional oracle in tests / optional sidecar if TS correctness or performance fails benchmarks.

## Consequences

- Comparison core never depends on RapidFuzz types
- Golden/oracle tests catch drift
