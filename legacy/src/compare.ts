import {
  jaroSimilarity,
  jaroWinklerSimilarity,
  levenshteinSimilarity,
  normalizeMark,
} from './similarity.js';
import type {
  ComparisonEvidence,
  ComparisonResult,
  ConflictRiskBand,
  TrademarkCompareInput,
} from './types.js';

function riskBandFromScore(score: number): ConflictRiskBand {
  if (score >= 0.95) return 'critical';
  if (score >= 0.85) return 'strong';
  if (score >= 0.7) return 'relevant';
  if (score >= 0.55) return 'borderline';
  if (score >= 0.35) return 'weak';
  return 'irrelevant';
}

/**
 * Compare two trademark strings and return a risk band with evidence.
 * Pure string-similarity baseline — not legal advice.
 */
export function compareTrademarks(input: TrademarkCompareInput): ComparisonResult {
  const markA = normalizeMark(input.markA);
  const markB = normalizeMark(input.markB);

  const exact = markA.length > 0 && markA === markB ? 1 : 0;
  const levenshtein = levenshteinSimilarity(markA, markB);
  const jaro = jaroSimilarity(markA, markB);
  const jaroWinkler = jaroWinklerSimilarity(markA, markB);
  const combined = exact === 1 ? 1 : 0.35 * levenshtein + 0.25 * jaro + 0.4 * jaroWinkler;

  const evidence: ComparisonEvidence[] = [
    {
      id: 'exact-match',
      type: 'exact',
      details: { score: exact },
    },
    {
      id: 'levenshtein',
      type: 'orthographic',
      details: { score: Number(levenshtein.toFixed(4)) },
    },
    {
      id: 'jaro-winkler',
      type: 'orthographic',
      details: { score: Number(jaroWinkler.toFixed(4)) },
    },
  ];

  return {
    riskBand: riskBandFromScore(combined),
    similarity: {
      exact,
      levenshtein: Number(levenshtein.toFixed(4)),
      jaro: Number(jaro.toFixed(4)),
      jaroWinkler: Number(jaroWinkler.toFixed(4)),
      combined: Number(combined.toFixed(4)),
    },
    evidence,
    normalized: { markA, markB },
  };
}
