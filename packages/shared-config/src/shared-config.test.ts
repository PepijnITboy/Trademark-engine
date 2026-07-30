import { describe, expect, it } from "vitest";
import { loadConfigFromValues } from "./index.js";

describe("@trademark-engine/shared-config", () => {
  it("applies defaults for optional fields", () => {
    const config = loadConfigFromValues({
      databaseUrl: "postgresql://localhost:5432/trademark_engine",
    });

    expect(config.engineVersion).toBe("0.1.0");
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe("info");
    expect(config.corpusDatabaseUrl).toBeUndefined();
  });

  it("parses explicit overrides", () => {
    const config = loadConfigFromValues({
      databaseUrl: "postgresql://localhost:5432/trademark_engine",
      corpusDatabaseUrl: "postgresql://localhost:5432/corpus",
      engineVersion: "0.2.0",
      port: "8080",
      logLevel: "debug",
    });

    expect(config.corpusDatabaseUrl).toBe("postgresql://localhost:5432/corpus");
    expect(config.engineVersion).toBe("0.2.0");
    expect(config.port).toBe(8080);
    expect(config.logLevel).toBe("debug");
  });
});
