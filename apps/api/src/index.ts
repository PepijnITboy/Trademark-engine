import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadApiConfig } from "./config.js";
import { buildServer } from "./server.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

async function main() {
  const config = loadApiConfig();
  const app = await buildServer(config);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
