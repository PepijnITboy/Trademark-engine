export type NormalizedStatus =
  | "pending"
  | "registered"
  | "expired"
  | "cancelled"
  | "withdrawn"
  | "refused"
  | "unknown";

/** Filter 1: only these source statuses are bridged into the engine corpus. */
export const BRIDGE_SOURCE_STATUSES = ["REGISTERED", "ACCEPTED"] as const;

export type BridgeSourceStatus = (typeof BRIDGE_SOURCE_STATUSES)[number];

const REGISTERED_STATUSES = new Set([
  "REGISTERED",
  "REGISTERED_BY_WIPO",
  "ACCEPTED",
]);

const EXPIRED_STATUSES = new Set(["EXPIRED"]);

const WITHDRAWN_STATUSES = new Set(["WITHDRAWN"]);

const REFUSED_STATUSES = new Set(["REFUSED", "NOT_REGISTERED_BY_WIPO"]);

const CANCELLED_STATUSES = new Set([
  "CANCELLED",
  "SURRENDERED",
  "REMOVED_FROM_REGISTER",
]);

const PENDING_STATUSES = new Set([
  "RECEIVED",
  "UNDER_EXAMINATION",
  "APPLICATION_PUBLISHED",
  "REGISTRATION_PENDING",
  "OPPOSITION_PENDING",
  "APPEAL_PENDING",
  "SUSPENDED",
]);

export function isBridgeSourceStatus(statusCode: string | null | undefined): boolean {
  if (statusCode == null) {
    return false;
  }
  const normalized = statusCode.trim().toUpperCase();
  return (BRIDGE_SOURCE_STATUSES as readonly string[]).includes(normalized);
}

export function normalizeStatus(statusCode: string): NormalizedStatus {
  const normalized = statusCode.trim().toUpperCase();

  if (REGISTERED_STATUSES.has(normalized)) {
    return "registered";
  }
  if (EXPIRED_STATUSES.has(normalized)) {
    return "expired";
  }
  if (WITHDRAWN_STATUSES.has(normalized)) {
    return "withdrawn";
  }
  if (REFUSED_STATUSES.has(normalized)) {
    return "refused";
  }
  if (CANCELLED_STATUSES.has(normalized)) {
    return "cancelled";
  }
  if (PENDING_STATUSES.has(normalized)) {
    return "pending";
  }

  return "unknown";
}
