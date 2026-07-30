import { describe, expect, it } from "vitest";
import {
  mapSupabaseRowToCorpusRow,
  resolveCorpusLimit,
} from "./bridge-from-supabase.js";

describe("mapSupabaseRowToCorpusRow", () => {
  it("maps supabase-shaped rows to CorpusRow", () => {
    const mapped = mapSupabaseRowToCorpusRow({
      application_number: "018123456",
      mark_name: "ACME",
      status: "REGISTERED",
      nice_classes: [9, 35],
      application_date: "2020-01-15",
      registration_date: "2020-06-01",
    });

    expect(mapped).toEqual({
      application_number: "018123456",
      mark_name: "ACME",
      status: "REGISTERED",
      nice_classes: [9, 35],
      application_date: "2020-01-15",
      registration_date: "2020-06-01",
    });
  });

  it("coerces missing nice_classes to an empty array", () => {
    const mapped = mapSupabaseRowToCorpusRow({
      application_number: "018999999",
      mark_name: "EMPTY CLASSES",
      status: "pending",
      nice_classes: null,
      application_date: null,
      registration_date: null,
    });

    expect(mapped.nice_classes).toEqual([]);
    expect(mapped.application_date).toBeNull();
  });

  it("stringifies numeric application_number values", () => {
    const mapped = mapSupabaseRowToCorpusRow({
      application_number: "12345" as unknown as string,
      mark_name: "NUM",
      status: "registered",
      nice_classes: [1],
      application_date: null,
      registration_date: null,
    });

    expect(mapped.application_number).toBe("12345");
  });
});

describe("resolveCorpusLimit", () => {
  it("defaults to 100000 when env unset", () => {
    expect(resolveCorpusLimit(undefined, undefined)).toBe(100_000);
  });

  it("treats 0 as uncapped", () => {
    expect(resolveCorpusLimit(0)).toBeNull();
    expect(resolveCorpusLimit(undefined, "0")).toBeNull();
  });

  it("uses explicit positive limit", () => {
    expect(resolveCorpusLimit(50_000)).toBe(50_000);
    expect(resolveCorpusLimit(undefined, "25000")).toBe(25_000);
  });
});
