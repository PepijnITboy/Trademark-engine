# ADR 0004 — ICU / Unicode strategy

## Status

Accepted

## Context

Node provides `String.normalize` and `Intl` (full ICU by default on modern Node). Script transliteration (`Any-Latin`) is not exposed as a high-level JS API without bindings or a sidecar.

## Decision

- Use Node `String.normalize`, case folding helpers, and `Intl.Segmenter` for graphemes
- Implement diacritics/punctuation folds in `@trademark-engine/normalization` with golden tests
- Provide transliteration via a versioned adapter: rule tables + ICU Any-Latin when available (Docker-pinned bind or small sidecar); always store multiple variants
- Document Unicode/ICU versions in package metadata

## Consequences

- Deterministic tests pin expected transliterations
- Cross-script retrieval depends on transliteration quality
