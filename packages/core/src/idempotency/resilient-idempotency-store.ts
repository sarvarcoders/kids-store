import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

const configSchema = z.object({
  keyPrefix: z.string().trim().min(1).max(40),
  lockTtlMs: z.number().int().min(1_000).max(5 * 60_000).default(30_000),
  pollIntervalMs: z.number().int().min(10).max(1_000).default(50),
  pollTimeoutMs: z.number().int().min(100).max(30_000).default(5_000),
  ttlMs: z.number().int().min(1_000).max(24 * 60 * 60_000),
});
const scopeSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9:_-]+$/i);
const idempotencyKeySchema = z.string().trim().min(8).max(300);

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export interface RedisIdempotencyClient {
  eval(script: string, keyCount: number, ...args: (string | number)[]): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "PX",
    ttlMs: number,
    condition?: "NX",
  ): Promise<unknown>;
}

export class IdempotencyInProgressError extends Error {
  constructor() {
    super("IDEMPOTENCY_IN_PROGRESS");
    this.name = "IdempotencyInProgressError";
  }
}

export interface ResilientIdempotencyStoreConfig {
  keyPrefix: string;
  lockTtlMs?: number;
  onRedisError?: (error: unknown) => void;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  redis?: RedisIdempotencyClient;
  ttlMs: number;
}

export interface IdempotencyResult<TValue> {
  replayed: boolean;
  value: TValue;
}

interface LocalCompletedValue {
  expiresAt: number;
  serialized: string;
}

export class ResilientIdempotencyStore {
  private readonly completed = new Map<string, LocalCompletedValue>();
  private readonly keyPrefix: string;
  private readonly lockTtlMs: number;
  private readonly onRedisError: ((error: unknown) => void) | undefined;
  private readonly pending = new Map<string, Promise<string>>();
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly redis: RedisIdempotencyClient | undefined;
  private readonly ttlMs: number;

  constructor(input: ResilientIdempotencyStoreConfig) {
    const config = configSchema.parse(input);

    this.keyPrefix = config.keyPrefix;
    this.lockTtlMs = config.lockTtlMs;
    this.onRedisError = input.onRedisError;
    this.pollIntervalMs = config.pollIntervalMs;
    this.pollTimeoutMs = config.pollTimeoutMs;
    this.redis = input.redis;
    this.ttlMs = config.ttlMs;
  }

  async run<TValue>(
    scopeInput: string,
    keyInput: string,
    operation: () => Promise<TValue>,
  ): Promise<IdempotencyResult<TValue>> {
    const scope = scopeSchema.parse(scopeInput);
    const key = idempotencyKeySchema.parse(keyInput);
    const storageKey = this.storageKey(scope, key);

    if (this.redis) {
      return this.runDistributed(storageKey, operation);
    }

    return this.runLocal(storageKey, operation);
  }

  private async runDistributed<TValue>(
    storageKey: string,
    operation: () => Promise<TValue>,
  ): Promise<IdempotencyResult<TValue>> {
    const resultKey = `${storageKey}:result`;
    const lockKey = `${storageKey}:lock`;
    const stored = await this.redis?.get(resultKey);

    if (stored !== null && stored !== undefined) {
      return { replayed: true, value: JSON.parse(stored) as TValue };
    }

    const lockToken = randomUUID();
    const acquired = await this.redis?.set(
      lockKey,
      lockToken,
      "PX",
      this.lockTtlMs,
      "NX",
    );

    if (acquired !== "OK") {
      return this.waitForDistributedResult<TValue>(resultKey);
    }

    try {
      const value = await operation();
      const serialized = JSON.stringify(value);

      try {
        await this.redis?.set(resultKey, serialized, "PX", this.ttlMs);
      } catch (error) {
        this.onRedisError?.(error);
      }
      return { replayed: false, value };
    } finally {
      try {
        await this.redis?.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken);
      } catch (error) {
        this.onRedisError?.(error);
      }
    }
  }

  private async waitForDistributedResult<TValue>(
    resultKey: string,
  ): Promise<IdempotencyResult<TValue>> {
    const deadline = Date.now() + this.pollTimeoutMs;

    while (Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.pollIntervalMs);
      });

      let stored: string | null | undefined;

      try {
        stored = await this.redis?.get(resultKey);
      } catch (error) {
        this.onRedisError?.(error);
        throw new IdempotencyInProgressError();
      }

      if (stored !== null && stored !== undefined) {
        return { replayed: true, value: JSON.parse(stored) as TValue };
      }
    }

    throw new IdempotencyInProgressError();
  }

  private async runLocal<TValue>(
    storageKey: string,
    operation: () => Promise<TValue>,
  ): Promise<IdempotencyResult<TValue>> {
    const now = Date.now();
    const completed = this.completed.get(storageKey);

    if (completed && completed.expiresAt > now) {
      return {
        replayed: true,
        value: JSON.parse(completed.serialized) as TValue,
      };
    }

    const pending = this.pending.get(storageKey);

    if (pending) {
      return {
        replayed: true,
        value: JSON.parse(await pending) as TValue,
      };
    }

    const operationPromise = operation()
      .then((value) => {
        const serialized = JSON.stringify(value);
        this.pruneLocalCompleted();
        this.completed.set(storageKey, {
          expiresAt: Date.now() + this.ttlMs,
          serialized,
        });
        return serialized;
      })
      .finally(() => {
        this.pending.delete(storageKey);
      });

    this.pending.set(storageKey, operationPromise);

    return {
      replayed: false,
      value: JSON.parse(await operationPromise) as TValue,
    };
  }

  private pruneLocalCompleted(): void {
    const now = Date.now();

    for (const [key, value] of this.completed) {
      if (value.expiresAt <= now) {
        this.completed.delete(key);
      }
    }

    if (this.completed.size >= 5_000) {
      const oldest = this.completed.keys().next().value;
      if (oldest !== undefined) {
        this.completed.delete(oldest);
      }
    }
  }

  private storageKey(scope: string, key: string): string {
    const digest = createHash("sha256").update(`${scope}:${key}`).digest("hex");
    return `${this.keyPrefix}:idempotency:${digest}`;
  }
}
