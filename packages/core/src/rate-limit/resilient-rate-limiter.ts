import { createHash } from "node:crypto";
import { z } from "zod";

import { FixedWindowRateLimiter } from "./fixed-window.js";

const distributedLimiterConfigSchema = z.object({
  keyPrefix: z.string().trim().min(1).max(40),
  limit: z.number().int().positive().max(10_000),
  maxEntries: z.number().int().positive().max(100_000).default(10_000),
  scope: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  windowMs: z.number().int().positive().max(3_600_000),
});
const limiterKeySchema = z.string().trim().min(1).max(300);
const redisResultSchema = z.tuple([
  z.coerce.number().int().positive(),
  z.coerce.number().int(),
]);

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

export interface RedisEvalClient {
  eval(
    script: string,
    numberOfKeys: number,
    ...arguments_: (string | number)[]
  ): Promise<unknown>;
}

export interface ResilientRateLimiterConfig {
  keyPrefix: string;
  limit: number;
  maxEntries?: number;
  onRedisError?: (error: unknown) => void;
  redis?: RedisEvalClient | null;
  scope: string;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  source: "memory" | "redis";
}

export class ResilientRateLimiter {
  private readonly fallback: FixedWindowRateLimiter;
  private readonly keyPrefix: string;
  private readonly limit: number;
  private readonly onRedisError: ((error: unknown) => void) | undefined;
  private readonly redis: RedisEvalClient | null;
  private readonly scope: string;
  private readonly windowMs: number;

  constructor(configInput: ResilientRateLimiterConfig) {
    const config = distributedLimiterConfigSchema.parse(configInput);

    this.fallback = new FixedWindowRateLimiter({
      limit: config.limit,
      maxEntries: config.maxEntries,
      windowMs: config.windowMs,
    });
    this.keyPrefix = config.keyPrefix;
    this.limit = config.limit;
    this.onRedisError = configInput.onRedisError;
    this.redis = configInput.redis ?? null;
    this.scope = config.scope;
    this.windowMs = config.windowMs;
  }

  async consume(
    keyInput: unknown,
    nowInput: unknown = Date.now(),
  ): Promise<RateLimitDecision> {
    const key = limiterKeySchema.parse(keyInput);

    if (this.redis) {
      try {
        const redisKey = `${this.keyPrefix}:rate-limit:${this.scope}:${createHash("sha256").update(key).digest("hex")}`;
        const result = redisResultSchema.parse(
          await this.redis.eval(
            RATE_LIMIT_SCRIPT,
            1,
            redisKey,
            this.windowMs,
          ),
        );
        const [count, ttl] = result;

        return {
          allowed: count <= this.limit,
          remaining: Math.max(0, this.limit - count),
          retryAfterMs: Math.max(0, ttl),
          source: "redis",
        };
      } catch (error) {
        this.onRedisError?.(error);
      }
    }

    const allowed = this.fallback.consume(key, nowInput);

    return {
      allowed,
      remaining: allowed ? 1 : 0,
      retryAfterMs: allowed ? 0 : this.windowMs,
      source: "memory",
    };
  }
}
