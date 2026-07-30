export { compareTrademarks } from './compare.js';
export {
  jaroSimilarity,
  jaroWinklerSimilarity,
  levenshteinSimilarity,
  normalizeMark,
} from './similarity.js';
export type {
  ComparisonEvidence,
  ComparisonResult,
  ConflictRiskBand,
  SimilarityScores,
  TrademarkCompareInput,
} from './types.js';
