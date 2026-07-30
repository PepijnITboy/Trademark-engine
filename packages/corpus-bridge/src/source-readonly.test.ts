import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("test_database_europa read-only guard", () => {
  it("engine bridge only selects from the source table", () => {
    const source = readFileSync(join(here, "bridge-from-supabase.ts"), "utf8");
    const sourceUses = [...source.matchAll(/\.from\(\s*["']test_database_europa["']\s*\)/g)];
    expect(sourceUses.length).toBe(1);

    const afterFrom = source.slice(source.indexOf('.from("test_database_europa")'));
    const chain = afterFrom.slice(0, 500);
    expect(chain).toMatch(/\.select\(/);
    expect(chain).toMatch(/\.in\(\s*["']status["']/);
    expect(chain).not.toMatch(/\.(insert|upsert|update|delete)\(/);
  });
});
