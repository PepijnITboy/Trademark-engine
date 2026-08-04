# @trademark-engine/attorney-analysis

Post-engine Anthropic analysis: takes up to 1000 ranked engine candidates and
returns a structured top-N trademark-attorney risk opinion (Dutch).

## Consistency

LLM outputs are never bit-identical across runs, but this package maximizes
stability with:

- fixed versioned system prompt (`PROMPT_VERSION`)
- deterministic user-prompt serialization (stable key order)
- `temperature: 0` by default
- strict JSON schema + zod validation (one schema-correction retry)

## Note

Conflict scores remain engine-owned. This package only selects and explains
risks; it does not recompute `experimentalConflictScore`.
