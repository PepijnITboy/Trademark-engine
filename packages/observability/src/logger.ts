import pino, { type Logger, type LoggerOptions } from "pino";

export interface CreateLoggerOptions {
  readonly level?: string;
  readonly name?: string;
  readonly bindings?: Record<string, unknown>;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level ?? "info",
  };

  if (options.name !== undefined) {
    loggerOptions.name = options.name;
  }

  const logger = pino(loggerOptions);

  if (options.bindings && Object.keys(options.bindings).length > 0) {
    return logger.child(options.bindings);
  }

  return logger;
}

export function withScanContext(
  logger: Logger,
  context: { scanId: string } & Record<string, unknown>,
): Logger {
  return logger.child(context);
}

export type { Logger };
