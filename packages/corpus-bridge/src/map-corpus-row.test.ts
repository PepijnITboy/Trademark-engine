import { describe, expect, it } from "vitest";
import {
  isTextSearchable,
  mapCorpusRowToTrademark,
} from "./map-corpus-row.js";
import type { CorpusRow } from "./types.js";

const corpusSourceId = "00000000-0000-4000-8000-000000000001";

const baseRow: CorpusRow = {
  application_number: "018123456",
  mark_name: "ACME",
  status: "REGISTERED",
  nice_classes: [35],
  application_date: "2020-01-15",
  registration_date: "2020-06-01",
};

describe("mapCorpusRowToTrademark", () => {
  it("marks empty mark_name as not text searchable", () => {
    expect(isTextSearchable("")).toBe(false);
    expect(isTextSearchable("   ")).toBe(false);

    const mapped = mapCorpusRowToTrademark(
      { ...baseRow, mark_name: "   " },
      corpusSourceId,
    );
    expect(mapped.trademark.isTextSearchable).toBe(false);
  });

  it("marks non-empty mark_name as text searchable", () => {
    const mapped = mapCorpusRowToTrademark(baseRow, corpusSourceId);
    expect(mapped.trademark.isTextSearchable).toBe(true);
  });

  it("maps source fields and creates goods stubs per nice class", () => {
    const mapped = mapCorpusRowToTrademark(
      { ...baseRow, nice_classes: [9, 35] },
      corpusSourceId,
    );

    expect(mapped.trademark.sourceRecordId).toBe("018123456");
    expect(mapped.trademark.markText).toBe("ACME");
    expect(mapped.trademark.normalizedStatus).toBe("registered");
    expect(mapped.goodsServiceStubs).toHaveLength(2);
    expect(mapped.goodsServiceStubs.map((stub) => stub.niceClass)).toEqual([
      9, 35,
    ]);
  });
});
