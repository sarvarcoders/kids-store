import { z } from "zod";

const rateLimitInputSchema = z.object({
  key: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(1_000),
  nowMs: z.number().int().nonnegative(),
  windowMs: z.number().int().min(1_000).max(3_600_000),
});

const attempts = new Map<string, number[]>();

export function assertRateLimit(input: {
  key: string;
  limit?: number;
  nowMs?: number;
  windowMs?: number;
}): void {
  const parsed = rateLimitInputSchema.parse({
    key: input.key,
    limit: input.limit ?? 30,
    nowMs: input.nowMs ?? Date.now(),
    windowMs: input.windowMs ?? 60_000,
  });
  const cutoff = parsed.nowMs - parsed.windowMs;
  const current = (attempts.get(parsed.key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (current.length >= parsed.limit) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  current.push(parsed.nowMs);
  attempts.set(parsed.key, current);

  if (attempts.size > 5_000) {
    const firstKey = attempts.keys().next().value;

    if (typeof firstKey === "string") {
      attempts.delete(firstKey);
    }
  }
}

export function resetRateLimitsForTests(): void {
  attempts.clear();
}
