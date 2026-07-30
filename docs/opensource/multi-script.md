# OSS survey — multi-script matching

| Project | Relevant idea | Decision |
|---|---|---|
| amt-phonetic | Language-agnostic spectral keys across scripts | **Evaluate** as optional retrieval key; default off |
| ICU Any-Latin | Cross-script retrieval bridge | **Adopt** |
| T-RADAR | Multimodal + LLM agents | **Reject** (AI out of scope); funnel UX ideas only |
| InfringeMark | XGBoost on court features | **Reject** (ML out of scope) |

Engine policy: never discard solely because scripts differ; transliteration + orthographic channels must remain available.
