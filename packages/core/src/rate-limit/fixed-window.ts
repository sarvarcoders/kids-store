import { z } from "zod";

const limiterConfigSchema = z.object({
  limit: z.number().int().positive().max(10_000),
  windowMs: z.number().int().positive().max(3_600_000),
  maxEntries: z.number().int().positive().max(100_000).default(10_000),
});
const limiterKeySchema = z.string().trim().min(1).max(160);
const timestampSchema = z.number().int().nonnegative();

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface FixedWindowRateLimiterConfig {
  limit: number;
  windowMs: number;
  maxEntries?: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;

  constructor(configInput: FixedWindowRateLimiterConfig) {
    const config = limiterConfigSchema.parse(configInput);

    this.limit = config.limit;
    this.windowMs = config.windowMs;
    this.maxEntries = config.maxEntries;
  }

  consume(keyInput: unknown, nowInput: unknown = Date.now()): boolean {
    const key = limiterKeySchema.parse(keyInput);
    const now = timestampSchema.parse(nowInput);
    const current = this.entries.get(key);

    if (
      current === undefined ||
      now - current.windowStartedAt >= this.windowMs
    ) {
      this.ensureCapacity(now, key);
      this.entries.set(key, {
        count: 1,
        windowStartedAt: now,
      });
      return true;
    }

    if (current.count >= this.limit) {
      return false;
    }

    current.count += 1;
    return true;
  }

  private ensureCapacity(now: number, incomingKey: string): void {
    if (
      this.entries.has(incomingKey) ||
      this.entries.size < this.maxEntries
    ) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (now - entry.windowStartedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }

    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
  }
}
