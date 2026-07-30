import { afterEach, describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";
import { buildServer } from "./server.js";
import { clearScanStore, getScan } from "./services/scan-store.js";

async function waitForScan(id: string, timeoutMs = 5_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const scan = getScan(id);
    if (scan?.status === "completed" || scan?.status === "failed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("api", () => {
  afterEach(() => {
    clearScanStore();
    delete process.env.ALLOW_SAMPLE_BRIDGE;
  });

  it("GET /health returns ok with unavailable database when unset", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      database: "unavailable",
    });
    await app.close();
  });

  it("GET /api/database/stats fails closed without DATABASE_URL", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const response = await app.inject({ method: "GET", url: "/api/database/stats" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "DATABASE_URL not configured",
    });
    await app.close();
  });

  it("POST /api/corpus-bridge sample mode is disabled by default", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const response = await app.inject({
      method: "POST",
      url: "/api/corpus-bridge",
      payload: { mode: "sample" },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("POST /api/internal/compare-pair returns comparison contract", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const response = await app.inject({
      method: "POST",
      url: "/api/internal/compare-pair",
      payload: { markA: "ZENZO", markB: "SENZO" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      comparison: { features: unknown; evidenceCodes: string[] };
      score: { experimentalConflictScore: number; riskBand: string };
      explanations: string[];
    };

    expect(body.comparison.features).toBeDefined();
    expect(body.comparison.evidenceCodes.length).toBeGreaterThan(0);
    expect(body.score.experimentalConflictScore).toBeGreaterThan(0);
    expect(body.score.riskBand).toBeTruthy();
    expect(body.explanations.length).toBeGreaterThan(0);
    await app.close();
  });

  it("POST /api/scans creates an async scan that fails without corpus", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/scans",
      payload: { markText: "ZENZO", selectedNiceClasses: [32] },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      id: string;
      status: string;
      markCount: number;
      markTexts: string[];
    };
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(["queued", "running"]).toContain(created.status);
    expect(created.markCount).toBe(1);
    expect(created.markTexts).toEqual(["ZENZO"]);

    await waitForScan(created.id);
    const scan = getScan(created.id);
    expect(scan?.status).toBe("failed");
    expect(scan?.error).toMatch(/corpus:bridge-100k|DATABASE_URL|Engine database empty/i);

    const progressResponse = await app.inject({
      method: "GET",
      url: `/api/scans/${created.id}/progress`,
    });
    expect(progressResponse.statusCode).toBe(200);
    const progress = progressResponse.json() as {
      percentComplete: number;
      elapsedMs: number;
      estimatedRemainingMs: number | null;
      stages: Array<{ id: string; status: string }>;
      markTotal: number;
    };
    expect(progress.stages.length).toBeGreaterThan(0);
    expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
    expect(progress.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(progress.markTotal).toBe(1);

    const resultsResponse = await app.inject({
      method: "GET",
      url: `/api/scans/${created.id}/results`,
    });
    expect(resultsResponse.statusCode).toBe(409);
    await app.close();
  });

  it("POST /api/scans accepts up to 10 comma-separated mark names", async () => {
    const app = await buildServer(loadApiConfig({ PORT: "3000", LOG_LEVEL: "silent" }));
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/scans",
      payload: {
        markTexts: ["ZENZO", "SENZO", "xenzo", "ZENZO"],
        selectedNiceClasses: [32],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      id: string;
      markCount: number;
      markTexts: string[];
    };
    expect(created.markCount).toBe(3);
    expect(created.markTexts).toEqual(["ZENZO", "SENZO", "xenzo"]);

    await waitForScan(created.id);
    const progressResponse = await app.inject({
      method: "GET",
      url: `/api/scans/${created.id}/progress`,
    });
    expect(progressResponse.statusCode).toBe(200);
    const progress = progressResponse.json() as {
      markTotal: number;
      marks: Array<{ markText: string; status: string }>;
    };
    expect(progress.markTotal).toBe(3);
    expect(progress.marks).toHaveLength(3);
    await app.close();
  });
});
