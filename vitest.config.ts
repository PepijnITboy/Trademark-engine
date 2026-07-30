import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
      "services/**/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "apps/dashboard/**"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
