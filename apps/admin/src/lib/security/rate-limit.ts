import { ResilientRateLimiter } from "@kids-store/core";
import { z } from "zod";

import {
  adminRedisConfig,
  getAdminRedisProducer,
  logAdminRedisFallback,
} from "../redis/server";

const rateLimitInputSchema = z.object({
  key: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(1_000),
  nowMs: z.number().int().nonnegative(),
  windowMs: z.number().int().min(1_000).max(3_600_000),
});

let limiters = new Map<string, ResilientRateLimiter>();

export async function assertRateLimit(input: {
  key: string;
  limit?: number;
  nowMs?: number;
  windowMs?: number;
}): Promise<void> {
  const parsed = rateLimitInputSchema.parse({
    key: input.key,
    limit: input.limit ?? 30,
    nowMs: input.nowMs ?? Date.now(),
    windowMs: input.windowMs ?? 60_000,
  });
  const limiterKey = `${String(parsed.limit)}:${String(parsed.windowMs)}`;
  let limiter = limiters.get(limiterKey);

  if (!limiter) {
    limiter = new ResilientRateLimiter({
      keyPrefix: adminRedisConfig?.keyPrefix ?? "kids-store",
      limit: parsed.limit,
      onRedisError: logAdminRedisFallback,
      redis: getAdminRedisProducer() ?? null,
      scope: `admin-${String(parsed.limit)}-${String(parsed.windowMs)}`,
      windowMs: parsed.windowMs,
    });
    limiters.set(limiterKey, limiter);
  }

  const decision = await limiter.consume(parsed.key, parsed.nowMs);

  if (!decision.allowed) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
}

export function resetRateLimitsForTests(): void {
  limiters = new Map<string, ResilientRateLimiter>();
}
