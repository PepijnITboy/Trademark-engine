import { createLogger } from "@trademark-engine/observability";
import type { WorkerConfig } from "./config.js";

export interface BossJobHandler {
  readonly name: string;
  readonly handler: (payload: unknown) => Promise<void>;
}

export interface BossStub {
  readonly started: boolean;
  registerJob(job: BossJobHandler): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createBossStub(config: WorkerConfig): BossStub {
  const logger = createLogger({ level: config.logLevel, name: "worker-boss-stub" });
  const jobs: BossJobHandler[] = [];
  let started = false;

  return {
    get started() {
      return started;
    },
    registerJob(job) {
      jobs.push(job);
      logger.info({ job: job.name }, "Registered pg-boss job stub");
    },
    async start() {
      started = true;
      logger.info({ jobCount: jobs.length }, "pg-boss stub started (no Redis required)");
    },
    async stop() {
      started = false;
      logger.info("pg-boss stub stopped");
    },
  };
}
