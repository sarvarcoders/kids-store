const sensitiveKeyPattern =
  /(token|secret|password|authorization|cookie|initdata|hash)/i;

function maskMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => maskMetadata(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, nested]) => [
          key,
          sensitiveKeyPattern.test(key)
            ? "[MASKED]"
            : maskMetadata(nested, depth + 1),
        ]),
    );
  }

  return value;
}

export function formatSafeAuditMetadata(value: unknown): string {
  const formatted = JSON.stringify(maskMetadata(value));

  if (!formatted) {
    return "{}";
  }

  return formatted.length <= 500
    ? formatted
    : `${formatted.slice(0, 499)}…`;
}
