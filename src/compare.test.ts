import { describe, expect, it } from 'vitest';
import { compareTrademarks } from './compare.js';
import { levenshteinSimilarity, normalizeMark } from './similarity.js';

describe('normalizeMark', () => {
  it('strips accents, case, and punctuation', () => {
    expect(normalizeMark('Café-One!')).toBe('cafeone');
  });
});

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('merk', 'merk')).toBe(1);
  });

  it('returns a high score for near matches', () => {
    expect(levenshteinSimilarity('merkwacht', 'merkwachtx')).toBeGreaterThan(0.8);
  });
});

describe('compareTrademarks', () => {
  it('flags exact matches as critical', () => {
    const result = compareTrademarks({ markA: 'Merkwacht', markB: 'merkwacht' });
    expect(result.riskBand).toBe('critical');
    expect(result.similarity.exact).toBe(1);
    expect(result.normalized.markA).toBe('merkwacht');
  });

  it('returns a lower band for unrelated marks', () => {
    const result = compareTrademarks({ markA: 'Alpha', markB: 'Zebra' });
    expect(['weak', 'irrelevant', 'borderline']).toContain(result.riskBand);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
