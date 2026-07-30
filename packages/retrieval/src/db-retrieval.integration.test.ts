import { closeDb, createDb } from "@trademark-engine/database";
import { describe, expect, it } from "vitest";
import {
  countSearchableTrademarks,
  retrieveExactCompact,
  retrievePhoneticKeys,
  retrieveTrigramCompact,
} from "./db-retrieval.js";
import { buildPhoneticLookupKeys } from "./retrieval.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("db retrieval integration", () => {
  it("runs exact and trigram queries against the engine database", async () => {
    const db = createDb(databaseUrl!);
    try {
      const searchableCount = await countSearchableTrademarks(db);
      expect(searchableCount).toBeGreaterThanOrEqual(0);

      const exactHits = await retrieveExactCompact(db, "nonexistent-mark-xyz", 5);
      expect(Array.isArray(exactHits)).toBe(true);

      const trigramHits = await retrieveTrigramCompact(db, "zenzo", 0.15, 5);
      expect(Array.isArray(trigramHits)).toBe(true);

      const phonetic = buildPhoneticLookupKeys("zkan");
      const phoneticHits = await retrievePhoneticKeys(
        db,
        phonetic.keys,
        phonetic.algorithms,
        5,
      );
      expect(Array.isArray(phoneticHits)).toBe(true);
    } finally {
      await closeDb(db);
    }
  });
});
