import { describe, expect, it, vi } from "vitest";
import {
  assertEngineCorpusReady,
  countPreCapPhonetic,
  countPreCapTrigram,
  EMPTY_BRIDGE_ERROR,
  EMPTY_PREPROCESS_ERROR,
  retrieveExactCompact,
  retrievePhoneticKeys,
  retrieveTrigramCompact,
} from "./db-retrieval.js";

describe("db retrieval helpers", () => {
  it("retrieveExactCompact maps database rows", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          trademark_id: "id-1",
          score: 1,
          mark_text: "ACME",
          nice_classes: [35],
          status: "registered",
        },
      ]),
    };

    const hits = await retrieveExactCompact(db as never, "acme", 10);
    expect(hits).toEqual([
      {
        trademarkId: "id-1",
        score: 1,
        markText: "ACME",
        niceClasses: [35],
        status: "registered",
      },
    ]);
  });

  it("retrieveTrigramCompact maps similarity scores", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          trademark_id: "id-2",
          score: 0.42,
          mark_text: "SENZO",
          nice_classes: [32],
          status: "registered",
        },
      ]),
    };

    const hits = await retrieveTrigramCompact(db as never, "zenzo", 0.15, 50);
    expect(hits[0]?.score).toBe(0.42);
    expect(hits[0]?.markText).toBe("SENZO");
  });

  it("retrievePhoneticKeys maps key matches", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          trademark_id: "id-scan",
          score: 1,
          mark_text: "SCAN",
          nice_classes: [9],
          status: "registered",
        },
      ]),
    };

    const hits = await retrievePhoneticKeys(
      db as never,
      ["SKN0", "SCN"],
      ["double_metaphone", "nysiis"],
      50,
    );
    expect(hits).toEqual([
      {
        trademarkId: "id-scan",
        score: 1,
        markText: "SCAN",
        niceClasses: [9],
        status: "registered",
      },
    ]);
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it("retrievePhoneticKeys returns empty for empty keys", async () => {
    const db = { execute: vi.fn() };
    await expect(
      retrievePhoneticKeys(db as never, [], ["double_metaphone"], 10),
    ).resolves.toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("countPreCapTrigram returns numeric count", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ count: 128 }]),
    };

    await expect(countPreCapTrigram(db as never, "zenzo", 0.15)).resolves.toBe(128);
  });

  it("countPreCapPhonetic returns numeric count", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ count: 3 }]),
    };

    await expect(
      countPreCapPhonetic(db as never, ["SKN0"], ["double_metaphone"]),
    ).resolves.toBe(3);
  });

  it("assertEngineCorpusReady fails when searchable is empty", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [{ count: 0 }],
        }),
      });

    const db = { select };

    await expect(assertEngineCorpusReady(db as never)).rejects.toThrow(
      EMPTY_BRIDGE_ERROR,
    );
  });

  it("assertEngineCorpusReady fails when normalized is empty", async () => {
    let call = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return {
            from: () => ({
              where: async () => [{ count: 10 }],
            }),
          };
        }
        return {
          from: async () => [{ count: 0 }],
        };
      }),
    };

    await expect(assertEngineCorpusReady(db as never)).rejects.toThrow(
      EMPTY_PREPROCESS_ERROR,
    );
  });
});
