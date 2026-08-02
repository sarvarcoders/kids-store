type LogContext = Readonly<Record<string, unknown>>;

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(code ? { code } : {}),
    };
  }

  return {
    value: error,
  };
}

function writeLog(
  level: "info" | "warn" | "error",
  message: string,
  context: LogContext = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  info(message: string, context?: LogContext): void {
    writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    writeLog("warn", message, context);
  },
  error(message: string, error: unknown, context: LogContext = {}): void {
    writeLog("error", message, {
      ...context,
      error: normalizeError(error),
    });
  },
};
