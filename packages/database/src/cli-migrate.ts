import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { migrate } from "./migrate.js";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://trademark:trademark@localhost:5432/trademark_engine";

await migrate(connectionString);
console.log("Migration applied successfully.");
