import { describe, expect, it } from "vitest";
import { createLogger, withScanContext } from "./index.js";

describe("@trademark-engine/observability", () => {
  it("creates a logger instance", () => {
    const logger = createLogger({ level: "silent", name: "test" });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });

  it("creates child loggers with scan bindings", () => {
    const logger = createLogger({ level: "silent" });
    const scanLogger = withScanContext(logger, { scanId: "scan-123" });

    expect(scanLogger).toBeDefined();
    expect(typeof scanLogger.debug).toBe("function");
  });
});
