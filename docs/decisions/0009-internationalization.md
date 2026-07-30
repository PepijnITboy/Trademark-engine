# ADR 0009 — Internationalization tiers

## Status

Accepted

## Decision

Unicode-first processing for all scripts. Deep phonetic/lexicon support (Tier A) for nl/en/de/fr/es/it. Broad transliteration + orthographic retrieval (Tier B) for all other scripts. Never discard a candidate solely because scripts differ.

## Consequences

- Larger index surface (original + translit forms)
- Confidence drops when phonetic coverage is missing
