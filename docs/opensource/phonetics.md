# OSS survey — phonetics

| Library / algo | License | Maintenance | Languages | Runtime | Decision |
|---|---|---|---|---|---|
| Double Metaphone | MIT ports | Stable | Latin/EN bias | Node | **Adopt** Tier A fallback |
| Cologne Phonetics | Public domain algo | Ports vary | German | Own TS + tests | **Adopt** |
| NYSIIS | Public domain | Ports | English names | TS | **Adopt** |
| Beider–Morse | Complex | Incomplete JS | Multi | Heavy | **Defer** until recall gap proven |
| eSpeak NG | GPL-3 | Excellent | Many (Tier A+) | Docker sidecar | **Adopt** (process isolation) |
| Epitran | MIT | Research | Many | Python | **Reject** v1 (overlap eSpeak) |
| Phonemizer | GPL-3 | Active | Via backends | Python | **Reject** (use eSpeak directly) |
| amt-phonetic | Check | Very young | Multi-script | Rust | **Evaluate** only after ADR + recall tests |

No universal phonetic algorithm: multiple signals per locale.
