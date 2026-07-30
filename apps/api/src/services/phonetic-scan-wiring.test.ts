import { describe, expect, it } from "vitest";
import {
  applyStrategyCap,
  buildPhoneticLookupKeys,
  unionCandidates,
  type StrategyResultRow,
} from "@trademark-engine/retrieval";

/**
 * Pure wiring contract for live phonetic retrieval:
 * query keys for zkan must be able to union a SCAN hit under strategy "phonetic".
 */
describe("phonetic scan wiring", () => {
  it("unions SCAN under phonetic strategy for zkan lookup keys", () => {
    const lookup = buildPhoneticLookupKeys("zkan");
    expect(lookup.keys.length).toBeGreaterThan(0);

    const scanKeys = new Set(buildPhoneticLookupKeys("scan").keys);
    expect(lookup.keys.some((key) => scanKeys.has(key))).toBe(true);

    const phoneticRows: StrategyResultRow[] = [
      {
        trademarkId: "scan-id",
        strategy: "phonetic",
        rank: 1,
        score: 1,
      },
    ];
    const capped = applyStrategyCap(
      phoneticRows.map((row) => ({
        trademarkId: row.trademarkId,
        score: row.score,
        evidence: [{ strategy: row.strategy, rank: row.rank, score: row.score }],
      })),
      50,
    );
    const union = unionCandidates({
      phonetic: capped.kept.map((item, index) => ({
        trademarkId: item.trademarkId,
        strategy: "phonetic",
        rank: index + 1,
        score: item.score,
      })),
    });

    expect(union.some((row) => row.trademarkId === "scan-id")).toBe(true);
    expect(union[0]?.evidence.some((item) => item.strategy === "phonetic")).toBe(true);
  });
});
