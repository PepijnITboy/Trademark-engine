import "dotenv/config";
import {
  closeDb,
  createDb,
  trademark,
  trademarkNormalizedRepresentation,
  trademarkPhoneticKey,
} from "@trademark-engine/database";
import { NORMALIZATION_VERSION } from "@trademark-engine/domain";
import { bigrams, trigrams } from "@trademark-engine/ngrams";
import { normalizeMark } from "@trademark-engine/normalization";
import {
  buildPhoneticKeyRecords,
  consonantSkeleton,
  type PhoneticKeyRecord,
} from "@trademark-engine/phonetics";
import { tokenizeMark } from "@trademark-engine/token-analysis";
import { transliterateToLatin } from "@trademark-engine/transliteration";
import { and, eq, isNull, sql } from "drizzle-orm";

const BATCH_SIZE = 500;

function compactAffixes(value: string): { prefixes: string[]; suffixes: string[] } {
  const prefixes: string[] = [];
  const suffixes: string[] = [];

  for (const length of [2, 3, 4]) {
    if (value.length >= length) {
      prefixes.push(value.slice(0, length));
      suffixes.push(value.slice(value.length - length));
    }
  }

  return { prefixes, suffixes };
}

async function upsertPhoneticKeys(
  db: ReturnType<typeof createDb>,
  trademarkId: string,
  records: readonly PhoneticKeyRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await db
    .insert(trademarkPhoneticKey)
    .values(
      records.map((record) => ({
        trademarkId,
        locale: record.locale,
        algorithm: record.algorithm,
        key: record.key,
      })),
    )
    .onConflictDoNothing({
      target: [
        trademarkPhoneticKey.trademarkId,
        trademarkPhoneticKey.locale,
        trademarkPhoneticKey.algorithm,
        trademarkPhoneticKey.key,
      ],
    });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const db = createDb(databaseUrl);
  const startedAt = Date.now();
  let processed = 0;
  let phoneticBackfilled = 0;

  try {
    while (true) {
      const rows = await db
        .select({
          id: trademark.id,
          markText: trademark.markText,
        })
        .from(trademark)
        .leftJoin(
          trademarkNormalizedRepresentation,
          eq(trademarkNormalizedRepresentation.trademarkId, trademark.id),
        )
        .where(
          and(
            eq(trademark.isTextSearchable, true),
            isNull(trademarkNormalizedRepresentation.trademarkId),
          ),
        )
        .limit(BATCH_SIZE);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const normalized = normalizeMark(row.markText);
        const tokens = tokenizeMark(row.markText);
        const transliteration = transliterateToLatin(row.markText);
        const affixes = compactAffixes(normalized.compact);
        const phoneticInput = normalized.diacriticsFolded || normalized.compact;
        const skeleton = consonantSkeleton(phoneticInput);
        const phoneticRecords = buildPhoneticKeyRecords(phoneticInput);

        await db
          .insert(trademarkNormalizedRepresentation)
          .values({
            trademarkId: row.id,
            raw: normalized.raw,
            unicodeNfc: normalized.unicodeNfc,
            unicodeNfkc: normalized.unicodeNfkc,
            caseFolded: normalized.caseFolded,
            diacriticsFolded: normalized.diacriticsFolded,
            punctuationFolded: normalized.punctuationFolded,
            whitespaceFolded: normalized.whitespaceFolded,
            asciiFolded: normalized.asciiFolded,
            compact: normalized.compact,
            tokens: tokens.tokens.map((token) => token.normalized),
            significantTokens: tokens.significantTokens.map((token) => token.normalized),
            weakTokens: tokens.weakTokens.map((token) => token.normalized),
            descriptiveTokens: tokens.weakTokens.map((token) => token.normalized),
            companySuffixTokens: tokens.companySuffixTokens.map((token) => token.normalized),
            dominantToken: tokens.dominantToken,
            prefixes: affixes.prefixes,
            suffixes: affixes.suffixes,
            bigrams: bigrams(normalized.compact),
            trigrams: trigrams(normalized.compact),
            consonantSkeletons: skeleton ? [skeleton] : [],
            transliterations: transliteration.variants,
            languageHypotheses: [],
            scripts: [...normalized.scripts],
            normalizationVersion: NORMALIZATION_VERSION,
          })
          .onConflictDoUpdate({
            target: trademarkNormalizedRepresentation.trademarkId,
            set: {
              raw: sql`excluded.raw`,
              unicodeNfc: sql`excluded.unicode_nfc`,
              unicodeNfkc: sql`excluded.unicode_nfkc`,
              caseFolded: sql`excluded.case_folded`,
              diacriticsFolded: sql`excluded.diacritics_folded`,
              punctuationFolded: sql`excluded.punctuation_folded`,
              whitespaceFolded: sql`excluded.whitespace_folded`,
              asciiFolded: sql`excluded.ascii_folded`,
              compact: sql`excluded.compact`,
              tokens: sql`excluded.tokens`,
              significantTokens: sql`excluded.significant_tokens`,
              weakTokens: sql`excluded.weak_tokens`,
              descriptiveTokens: sql`excluded.descriptive_tokens`,
              companySuffixTokens: sql`excluded.company_suffix_tokens`,
              dominantToken: sql`excluded.dominant_token`,
              prefixes: sql`excluded.prefixes`,
              suffixes: sql`excluded.suffixes`,
              bigrams: sql`excluded.bigrams`,
              trigrams: sql`excluded.trigrams`,
              consonantSkeletons: sql`excluded.consonant_skeletons`,
              transliterations: sql`excluded.transliterations`,
              languageHypotheses: sql`excluded.language_hypotheses`,
              scripts: sql`excluded.scripts`,
              normalizationVersion: sql`excluded.normalization_version`,
              updatedAt: new Date(),
            },
          });

        await upsertPhoneticKeys(db, row.id, phoneticRecords);
        processed += 1;
      }

      const elapsedMs = Date.now() - startedAt;
      const rate = processed > 0 ? (processed / elapsedMs) * 1000 : 0;
      console.log(
        `[preprocess] processed=${processed.toLocaleString()} elapsedMs=${elapsedMs} rate=${rate.toFixed(1)}/s`,
      );
    }

    // Backfill phonetic keys for marks that already have normalized representations.
    while (true) {
      const rows = await db.execute<{ id: string; mark_text: string }>(sql`
        SELECT t.id, t.mark_text
        FROM trademark t
        INNER JOIN trademark_normalized_representation tnr
          ON tnr.trademark_id = t.id
        WHERE t.is_text_searchable = true
          AND NOT EXISTS (
            SELECT 1
            FROM trademark_phonetic_key tpk
            WHERE tpk.trademark_id = t.id
          )
        ORDER BY t.id
        LIMIT ${BATCH_SIZE}
      `);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const normalized = normalizeMark(row.mark_text);
        const phoneticInput = normalized.diacriticsFolded || normalized.compact;
        const records = buildPhoneticKeyRecords(phoneticInput);
        // Sentinel so unencodable marks are not reselected forever.
        await upsertPhoneticKeys(
          db,
          row.id,
          records.length > 0
            ? records
            : [{ locale: "und", algorithm: "unencodable", key: "_" }],
        );
        phoneticBackfilled += 1;
      }

      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[preprocess] phoneticBackfilled=${phoneticBackfilled.toLocaleString()} elapsedMs=${elapsedMs}`,
      );
    }
  } finally {
    await closeDb(db);
  }

  const elapsedMs = Date.now() - startedAt;
  const rate = processed > 0 ? (processed / elapsedMs) * 1000 : 0;
  console.log(
    `Done. processed=${processed.toLocaleString()} phoneticBackfilled=${phoneticBackfilled.toLocaleString()} elapsedMs=${elapsedMs} rate=${rate.toFixed(1)}/s`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
