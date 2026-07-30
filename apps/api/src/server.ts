import cors from "@fastify/cors";
import {
  buildComparableFromMarkText,
  compareTrademarkPair,
} from "@trademark-engine/comparison";
import { bridgeSampleRows } from "@trademark-engine/corpus-bridge";
import { createDb } from "@trademark-engine/database";
import { explainFromEvidence } from "@trademark-engine/explanations";
import { SAMPLE_CORPUS_ROWS } from "@trademark-engine/fixtures";
import { createLogger } from "@trademark-engine/observability";
import { scoreFromFeatures } from "@trademark-engine/risk-engine";
import Fastify from "fastify";
import { z } from "zod";
import type { ApiConfig } from "./config.js";
import {
  fetchDatabaseSnapshot,
  fetchDatabaseStats,
} from "./services/database-stats.js";
import {
  configureScanStore,
  createScan,
  getScan,
  getScanMarkResults,
  getScanProgress,
  getScanResults,
  resolveMarkTexts,
} from "./services/scan-store.js";

const createScanBodySchema = z
  .object({
    markText: z.string().min(1).optional(),
    markTexts: z.array(z.string().min(1)).min(1).max(10).optional(),
    selectedNiceClasses: z.array(z.number().int().min(1).max(45)).optional(),
    goodsServices: z.array(z.string()).optional(),
    relevantLanguages: z.array(z.string()).optional(),
  })
  .refine((body) => Boolean(body.markText?.trim()) || (body.markTexts?.length ?? 0) > 0, {
    message: "Provide markText or markTexts (1–10 names)",
  });

const comparePairBodySchema = z.object({
  markA: z.string().min(1),
  markB: z.string().min(1),
  niceA: z.array(z.number().int()).optional(),
  niceB: z.array(z.number().int()).optional(),
});

const corpusBridgeBodySchema = z.object({
  mode: z.literal("sample"),
});

function sampleRowsForBridge() {
  return SAMPLE_CORPUS_ROWS.map((row) => ({
    application_number: row.id,
    mark_name: row.markText,
    status: row.status ?? "registered",
    nice_classes: [...(row.niceClasses ?? [])],
    application_date: null,
    registration_date: null,
  }));
}

function sampleBridgeAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_SAMPLE_BRIDGE === "1" || env.ALLOW_SAMPLE_BRIDGE === "true";
}

export async function buildServer(config: ApiConfig) {
  const logger = createLogger({ level: config.logLevel, name: "api" });
  const app = Fastify({ loggerInstance: logger });

  configureScanStore({ databaseUrl: config.databaseUrl });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    engineVersion: config.engineVersion,
    database: config.databaseUrl ? "connected" : "unavailable",
  }));

  app.get("/api/database/stats", async (_request, reply) => {
    if (!config.databaseUrl) {
      return reply.status(503).send({
        error: "DATABASE_URL not configured",
        hint: "Set DATABASE_URL and run corpus:bridge-100k + corpus:preprocess-100k",
      });
    }
    return fetchDatabaseStats(config.databaseUrl);
  });

  app.get("/api/database/snapshot", async (_request, reply) => {
    if (!config.databaseUrl) {
      return reply.status(503).send({
        error: "DATABASE_URL not configured",
        hint: "Set DATABASE_URL and run corpus:bridge-100k + corpus:preprocess-100k",
      });
    }
    return fetchDatabaseSnapshot(config.databaseUrl);
  });

  app.post("/api/scans", async (request, reply) => {
    const parsed = createScanBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const markTexts = resolveMarkTexts({
      ...(input.markText !== undefined ? { markText: input.markText } : {}),
      ...(input.markTexts !== undefined ? { markTexts: input.markTexts } : {}),
    });
    if (markTexts.length === 0) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: { formErrors: ["Provide at least one non-empty mark name"] },
      });
    }

    let scan;
    try {
      scan = createScan({
        markText: markTexts.join(", "),
        markTexts,
        ...(input.selectedNiceClasses !== undefined
          ? { selectedNiceClasses: input.selectedNiceClasses }
          : {}),
        ...(input.goodsServices !== undefined ? { goodsServices: input.goodsServices } : {}),
        ...(input.relevantLanguages !== undefined
          ? { relevantLanguages: input.relevantLanguages }
          : {}),
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Invalid scan input",
      });
    }

    return reply.status(201).send({
      id: scan.id,
      status: scan.status,
      markCount: markTexts.length,
      markTexts,
    });
  });

  app.get<{ Params: { id: string } }>("/api/scans/:id", async (request, reply) => {
    const scan = getScan(request.params.id);
    if (!scan) {
      return reply.status(404).send({ error: "Scan not found" });
    }

    return {
      id: scan.id,
      status: scan.status,
      input: scan.input,
      markTexts: scan.markTexts,
      markCount: scan.markTexts.length,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      error: scan.error ?? null,
    };
  });

  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/progress",
    async (request, reply) => {
      const progress = getScanProgress(request.params.id);
      if (!progress) {
        return reply.status(404).send({ error: "Scan not found" });
      }

      return progress;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/results",
    async (request, reply) => {
      const scan = getScan(request.params.id);
      if (!scan) {
        return reply.status(404).send({ error: "Scan not found" });
      }

      if (scan.status !== "completed") {
        return reply.status(409).send({
          error: "Scan not completed",
          status: scan.status,
        });
      }

      const results = getScanResults(request.params.id);
      const marks = getScanMarkResults(request.params.id) ?? [];
      return {
        scanId: scan.id,
        mode: "database",
        resultCount: results?.length ?? 0,
        results: results ?? [],
        marks: marks.map((item) => ({
          markText: item.markText,
          status: item.status,
          resultCount: item.results.length,
          results: item.results,
          ...(item.error !== undefined ? { error: item.error } : {}),
        })),
      };
    },
  );

  app.post("/api/internal/compare-pair", async (request, reply) => {
    const parsed = comparePairBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const { markA, markB, niceA, niceB } = parsed.data;
    const proposed = buildComparableFromMarkText(markA, niceA);
    const candidate = buildComparableFromMarkText(markB, niceB);
    const comparison = compareTrademarkPair(proposed, candidate, {
      ...(niceA !== undefined ? { proposedNiceClasses: niceA } : {}),
      ...(niceB !== undefined ? { candidateNiceClasses: niceB } : {}),
    });
    const score = scoreFromFeatures(comparison.features);
    const explanations = explainFromEvidence(comparison.evidenceCodes, {
      proposedMark: markA,
      candidateMark: markB,
    });

    return {
      comparison,
      score,
      explanations,
    };
  });

  app.post("/api/corpus-bridge", async (request, reply) => {
    const parsed = corpusBridgeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    if (!sampleBridgeAllowed()) {
      return reply.status(403).send({
        error: "Sample corpus bridge is disabled",
        hint: "Use pnpm corpus:bridge-100k for production bridging. Set ALLOW_SAMPLE_BRIDGE=1 only for fixture tests.",
      });
    }

    if (!config.databaseUrl) {
      return reply.status(503).send({
        error: "DATABASE_URL not configured",
        mode: parsed.data.mode,
      });
    }

    const db = createDb(config.databaseUrl);
    try {
      const result = await bridgeSampleRows(db, sampleRowsForBridge());
      return {
        status: "completed",
        mode: parsed.data.mode,
        ...result,
      };
    } finally {
      await db.$client.end();
    }
  });

  return app;
}
