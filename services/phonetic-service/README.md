# Phonetic service

Minimal HTTP service for phoneme generation.

## v1 stub

The current implementation uses a deterministic rule-based Latin stub (`espeak-stub-1`) so CI does not require espeak-ng. Responses include IPA-like strings and phoneme arrays derived from normalized Latin input.

## Swap-in espeak-ng

Replace `src/stub.ts` with an adapter that shells out to `espeak-ng --ipa` (or uses a native binding). Keep the response contract:

```json
{
  "ipa": "...",
  "phonemes": ["..."],
  "engineVersion": "espeak-ng-1"
}
```

## Run locally

```bash
pnpm --filter @trademark-engine/phonetic-service dev
```

## Docker

```bash
docker build -t trademark-phonetic-service services/phonetic-service
docker run --rm -p 3010:3010 trademark-phonetic-service
```
