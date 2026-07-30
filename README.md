# @trademark-engine/core

Standalone TypeScript library that compares two trademark strings and returns a
**conflict risk band** plus structured **evidence**. This is a signal — not legal
advice.

## Quick start

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Usage

```ts
import { compareTrademarks } from '@trademark-engine/core';

const result = compareTrademarks({
  markA: 'Merkwacht',
  markB: 'MerkwachtX',
});

console.log(result.riskBand); // e.g. "strong"
console.log(result.similarity.combined);
console.log(result.evidence);
```

## API

- `compareTrademarks({ markA, markB })` → `ComparisonResult`
- Helpers: `normalizeMark`, `levenshteinSimilarity`, `jaroSimilarity`, `jaroWinklerSimilarity`

Risk bands: `critical` | `strong` | `relevant` | `borderline` | `weak` | `irrelevant`

## Repo

GitHub: https://github.com/PepijnITboy/Trademark-engine
