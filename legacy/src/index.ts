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
export {
  EuipoClient,
  EuipoOAuthClient,
  loadEuipoConfig,
  DEFAULT_SEARCH_FIELDS,
} from './euipo/index.js';
export type { EuipoConfig, EuipoSearchParams } from './euipo/index.js';
