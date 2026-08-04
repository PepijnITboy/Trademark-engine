import { z } from "zod";

const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

function parseEnabledFlag(value: string | undefined, defaultEnabled: boolean): boolean {
  if (value === undefined || value === "") {
    return defaultEnabled;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export const apiEnvSchema = z.object({
  databaseUrl: z.string().min(1).optional(),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: logLevelSchema.default("info"),
  engineVersion: z.string().default("0.1.0"),
  anthropicApiKey: z.string().min(1).optional(),
  anthropicModel: z.string().default("claude-sonnet-4-6"),
  attorneyAnalysisEnabled: z.boolean().default(false),
  attorneyAnalysisCandidateLimit: z.coerce.number().int().positive().default(1000),
  attorneyAnalysisTopN: z.coerce.number().int().positive().max(10).default(10),
  attorneyAnalysisTemperature: z.coerce.number().min(0).max(1).default(0),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

export function loadApiConfig(
  env: Record<string, string | undefined> = process.env,
): ApiConfig {
  return apiEnvSchema.parse({
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    engineVersion: env.ENGINE_VERSION,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicModel: env.ANTHROPIC_MODEL,
    attorneyAnalysisEnabled: parseEnabledFlag(env.ATTORNEY_ANALYSIS_ENABLED, false),
    attorneyAnalysisCandidateLimit: env.ATTORNEY_ANALYSIS_CANDIDATE_LIMIT,
    attorneyAnalysisTopN: env.ATTORNEY_ANALYSIS_TOP_N,
    attorneyAnalysisTemperature: env.ATTORNEY_ANALYSIS_TEMPERATURE,
  });
}
