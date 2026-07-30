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

export const workerEnvSchema = z.object({
  databaseUrl: z.string().min(1).optional(),
  logLevel: logLevelSchema.default("info"),
  engineVersion: z.string().default("0.1.0"),
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(
  env: Record<string, string | undefined> = process.env,
): WorkerConfig {
  return workerEnvSchema.parse({
    databaseUrl: env.DATABASE_URL,
    logLevel: env.LOG_LEVEL,
    engineVersion: env.ENGINE_VERSION,
  });
}
