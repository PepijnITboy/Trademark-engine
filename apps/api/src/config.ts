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

export const apiEnvSchema = z.object({
  databaseUrl: z.string().min(1).optional(),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: logLevelSchema.default("info"),
  engineVersion: z.string().default("0.1.0"),
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
  });
}
