# Internationalization strategy (Unicode-first)

## Goal

A worldwide text engine: every mark with usable text is processable regardless of script, diacritics, or symbols. No Latin-only assumptions in normalization, indexes, or retrieval.

## Tiers

| Tier | Coverage | Methods |
|---|---|---|
| A (deep) | nl, en, de, fr, es, it | lexicons, weighted-edit rules, eSpeak, locale phonetic keys |
| B (broad) | all other scripts/languages | Unicode normalize, script tags, ICU Any-Latin transliteration, n-grams, trigram/exact on original + translit |
| C (symbols) | digits, punctuation, emoji/pictographs | keep in raw; rule-based digit/symbol features; never crash |

## Required pipeline steps

1. Grapheme segmentation (`Intl.Segmenter` / equivalent)
2. NFC + NFKC
3. Full case fold (not only `toLowerCase`)
4. Diacritics / punctuation / whitespace folds
5. Compact form
6. Script detection (ISO 15924 inventory)
7. Transliteration variants (bridge for cross-script retrieval)
8. Tokenization with Unicode boundaries

## Acceptance

- Cyrillic / Greek / CJK fixtures find Latin equivalents via transliteration where golden pairs exist
- Mixed-script and symbol-heavy marks do not crash
- Unknown locale → hypotheses + lower phonetic confidence, not hard failure
- Property tests cover RTL, ZWJ emoji, combining marks, astral planes, mixed scripts
