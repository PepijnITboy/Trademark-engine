import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function migrationFilePath(): string {
  return join(packageRoot, "migrations", "0001_engine_schema.sql");
}

export async function migrate(connectionString: string): Promise<void> {
  const migrationSql = readFileSync(migrationFilePath(), "utf-8");
  const sql = postgres(connectionString, { max: 1 });
  try {
    await sql.unsafe(migrationSql);
  } finally {
    await sql.end();
  }
}
