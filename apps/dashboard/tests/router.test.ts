import { describe, expect, it } from "vitest";
import router from "../src/router/index";

describe("dashboard router", () => {
  it("defines expected routes", () => {
    const paths = router.getRoutes().map((route) => route.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/scan/new");
    expect(paths).toContain("/scan/:id/progress");
    expect(paths).toContain("/scan/:id/results");
  });

  it("resolves named routes", () => {
    expect(router.resolve({ name: "home" }).path).toBe("/");
    expect(router.resolve({ name: "new-scan" }).path).toBe("/scan/new");
    expect(
      router.resolve({ name: "scan-progress", params: { id: "abc" } }).path,
    ).toBe("/scan/abc/progress");
    expect(
      router.resolve({ name: "scan-results", params: { id: "abc" } }).path,
    ).toBe("/scan/abc/results");
  });
});
