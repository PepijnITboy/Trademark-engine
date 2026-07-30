# OSS survey — ICU / transliteration

| Option | License | Notes | Decision |
|---|---|---|---|
| Node `String.normalize` + Intl | ICU/Unicode via Node | NFC/NFKC, Segmenter, full-icu default on modern Node | **Adopt** for normalize/graphemes |
| ICU Rule-Based Transliterator (`Any-Latin`, `Latin-ASCII`) | ICU | Best cross-script bridge | **Adopt** via pinned bind or sidecar |
| `icu-transliterator` npm | Depends on system ICU | Native build friction | **Evaluate** behind adapter |
| any-ascii / naive romanization | Various | Lossy fallback | **Adapt** as last-resort variant only |

Always store multiple transliteration variants when ambiguous. Golden fixtures for Cyrillic/Greek/CJK samples.
