import { describe, expect, it } from "vitest";
import { RISK_BANDS, type RiskBand } from "./index.js";

describe("@trademark-engine/domain", () => {
  it("includes all expected risk band values", () => {
    const expected: RiskBand[] = [
      "very_strong",
      "strong",
      "relevant",
      "weak",
      "low",
    ];

    for (const band of expected) {
      expect(RISK_BANDS).toContain(band);
    }
  });
});
