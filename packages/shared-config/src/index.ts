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

export const envSchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  corpusDatabaseUrl: z.string().min(1).optional(),
  engineVersion: z.string().default("0.1.0"),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: logLevelSchema.default("info"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  return envSchema.parse({
    databaseUrl: env.DATABASE_URL,
    corpusDatabaseUrl: env.CORPUS_DATABASE_URL,
    engineVersion: env.ENGINE_VERSION,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
  });
}

export function loadConfigFromValues(values: {
  databaseUrl: string;
  corpusDatabaseUrl?: string | undefined;
  engineVersion?: string | undefined;
  port?: string | number | undefined;
  logLevel?: string | undefined;
}): AppConfig {
  return envSchema.parse(values);
}
