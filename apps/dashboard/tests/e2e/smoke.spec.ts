import { test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test.skip(
    process.env.SKIP_E2E === "1" || process.env.CI === "true",
    "Skipped without local dev server",
  );

  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Database overview" }).waitFor();
  });
});
