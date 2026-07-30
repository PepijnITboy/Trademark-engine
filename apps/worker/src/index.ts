import { createLogger } from "@trademark-engine/observability";
import { loadWorkerConfig } from "./config.js";
import { createBossStub } from "./boss-stub.js";
import { preprocessMark, runPreprocessBatch } from "./preprocess.js";

export { preprocessMark, runPreprocessBatch, type PreprocessedMark } from "./preprocess.js";
export { createBossStub, type BossStub } from "./boss-stub.js";
export { loadWorkerConfig, type WorkerConfig } from "./config.js";

async function main() {
  const config = loadWorkerConfig();
  const logger = createLogger({ level: config.logLevel, name: "worker" });
  const boss = createBossStub(config);

  boss.registerJob({
    name: "preprocess-mark-batch",
    handler: async (payload) => {
      const marks = Array.isArray(payload) ? payload.filter((item) => typeof item === "string") : [];
      const results = await runPreprocessBatch(marks);
      logger.info({ count: results.length }, "Processed mark batch");
    },
  });

  await boss.start();
  logger.info(
    {
      engineVersion: config.engineVersion,
      database: config.databaseUrl ? "configured" : "none",
      sample: preprocessMark("ZENZO").phonetics.primary,
    },
    "Worker ready",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
