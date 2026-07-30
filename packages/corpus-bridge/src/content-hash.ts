import { createHash } from "node:crypto";
import type { CorpusRow } from "./types.js";

function stablePayload(row: CorpusRow): string {
  const niceClasses = [...row.nice_classes].sort((a, b) => a - b);
  return JSON.stringify({
    application_date: row.application_date,
    mark_name: row.mark_name,
    nice_classes: niceClasses,
    registration_date: row.registration_date,
    status: row.status,
  });
}

export function contentHash(row: CorpusRow): string {
  return createHash("sha256").update(stablePayload(row)).digest("hex");
}
