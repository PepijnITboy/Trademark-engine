export type { ProposedGoodsService, ProposedTrademark } from "./proposed-trademark.js";
export type {
  TrademarkGoodsServiceRecord,
  TrademarkRecord,
} from "./trademark-record.js";
export type { ClassifiedToken, TokenRole } from "./token-role.js";
export {
  RETRIEVAL_STRATEGIES,
  type RetrievalStrategy,
} from "./retrieval-strategy.js";
export type {
  ConceptualFeatureFamily,
  ContextFeatureFamily,
  ExactFeatureFamily,
  FeatureVectorMetadata,
  GoodsServicesFeatureFamily,
  OrthographicFeatureFamily,
  PhoneticFeatureFamily,
  RetrievalFeatureFamily,
  TokenFeatureFamily,
  TrademarkFeatureVector,
} from "./feature-vector.js";
export {
  RISK_BANDS,
  type ConfidenceLevel,
  type RiskBand,
  type TrademarkRiskOutput,
} from "./risk-output.js";
export {
  lengthBucketFor,
  pickLengthBucketThreshold,
  type LengthBucket,
  type LengthBucketThresholds,
} from "./length-buckets.js";
export {
  ENGINE_VERSION,
  NORMALIZATION_VERSION,
  PHONETIC_VERSION,
  PRUNING_PROFILE_VERSION,
  RETRIEVAL_PROFILE_VERSION,
  SCORE_VERSION,
  TOKEN_ANALYSIS_VERSION,
  TRANSLITERATION_VERSION,
} from "./versions.js";
