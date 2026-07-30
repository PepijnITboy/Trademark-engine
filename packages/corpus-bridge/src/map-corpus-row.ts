import type { TrademarkInsert } from "@trademark-engine/database";
import { contentHash } from "./content-hash.js";
import { normalizeStatus } from "./normalize-status.js";
import { MAPPING_VERSION, type CorpusRow } from "./types.js";

export interface MappedGoodsServiceStub {
  niceClass: number;
  language: string;
  originalText: string;
  normalizedText: string;
}

export interface MappedTrademark {
  trademark: Omit<TrademarkInsert, "id" | "createdAt" | "updatedAt">;
  goodsServiceStubs: MappedGoodsServiceStub[];
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isTextSearchable(markName: string): boolean {
  return markName.trim().length > 0;
}

export function mapCorpusRowToTrademark(
  row: CorpusRow,
  corpusSourceId: string,
): MappedTrademark {
  const mappedAt = new Date();
  const hash = contentHash(row);

  const trademark: MappedTrademark["trademark"] = {
    corpusSourceId,
    sourceRecordId: row.application_number,
    applicationNumber: row.application_number,
    markText: row.mark_name,
    markType: "word",
    statusCode: row.status,
    normalizedStatus: normalizeStatus(row.status),
    filingDate: parseDate(row.application_date),
    registrationDate: parseDate(row.registration_date),
    niceClasses: [...row.nice_classes],
    territories: [],
    sourceLanguages: [],
    isTextSearchable: isTextSearchable(row.mark_name),
    sourceHash: hash,
    mappingVersion: MAPPING_VERSION,
    mappedAt,
  };

  const goodsServiceStubs = row.nice_classes.map((niceClass) => ({
    niceClass,
    language: "unknown",
    originalText: `Nice class ${niceClass}`,
    normalizedText: `nice class ${niceClass}`,
  }));

  return { trademark, goodsServiceStubs };
}
