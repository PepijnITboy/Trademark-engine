import { describe, expect, it } from "vitest";
import { contentHash } from "./content-hash.js";
import type { CorpusRow } from "./types.js";

const baseRow: CorpusRow = {
  application_number: "018123456",
  mark_name: "ACME",
  status: "REGISTERED",
  nice_classes: [35, 9],
  application_date: "2020-01-15",
  registration_date: "2020-06-01",
};

describe("contentHash", () => {
  it("is stable for identical rows", () => {
    const first = contentHash(baseRow);
    const second = contentHash({ ...baseRow });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable regardless of nice_classes order", () => {
    const ordered = contentHash({ ...baseRow, nice_classes: [9, 35] });
    const reversed = contentHash({ ...baseRow, nice_classes: [35, 9] });
    expect(ordered).toBe(reversed);
  });

  it("changes when mark_name changes", () => {
    const original = contentHash(baseRow);
    const changed = contentHash({ ...baseRow, mark_name: "ACME CORP" });
    expect(original).not.toBe(changed);
  });
});
