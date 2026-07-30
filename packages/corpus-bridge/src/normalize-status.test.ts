import { describe, expect, it } from "vitest";
import {
  BRIDGE_SOURCE_STATUSES,
  isBridgeSourceStatus,
  normalizeStatus,
} from "./normalize-status.js";

describe("normalizeStatus", () => {
  it.each([
    ["REGISTERED", "registered"],
    ["REGISTERED_BY_WIPO", "registered"],
    ["ACCEPTED", "registered"],
    ["EXPIRED", "expired"],
    ["WITHDRAWN", "withdrawn"],
    ["REFUSED", "refused"],
    ["CANCELLED", "cancelled"],
    ["SURRENDERED", "cancelled"],
    ["REMOVED_FROM_REGISTER", "cancelled"],
    ["RECEIVED", "pending"],
    ["UNDER_EXAMINATION", "pending"],
    ["APPLICATION_PUBLISHED", "pending"],
    ["REGISTRATION_PENDING", "pending"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  it("returns unknown for unrecognized statuses", () => {
    expect(normalizeStatus("MYSTERY_STATUS")).toBe("unknown");
  });
});

describe("isBridgeSourceStatus", () => {
  it("allows only filter-1 statuses", () => {
    expect(BRIDGE_SOURCE_STATUSES).toEqual(["REGISTERED", "ACCEPTED"]);
    expect(isBridgeSourceStatus("REGISTERED")).toBe(true);
    expect(isBridgeSourceStatus("accepted")).toBe(true);
    expect(isBridgeSourceStatus("EXPIRED")).toBe(false);
    expect(isBridgeSourceStatus("REFUSED")).toBe(false);
    expect(isBridgeSourceStatus("WITHDRAWN")).toBe(false);
    expect(isBridgeSourceStatus("OPPOSITION_PENDING")).toBe(false);
    expect(isBridgeSourceStatus(null)).toBe(false);
  });
});
