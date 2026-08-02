import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import {
  createRedisConnection,
  hasMatchingRevalidationSecret,
  notificationJobSchema,
  parseRedisRuntimeConfig,
  RedisSessionStorage,
  ResilientIdempotencyStore,
  ResilientRateLimiter,
} from "../src/index.js";

void test("Upstash TCP URLni avtomatik TLS formatiga o‘tkazadi", () => {
  const config = parseRedisRuntimeConfig({
    REDIS_KEY_PREFIX: "test",
    REDIS_URL:
      "redis://default:test-password@test-database.upstash.io:6379",
  });

  assert.ok(config);
  assert.equal(new URL(config.url).protocol, "rediss:");
});

void test("oddiy Redis hostining protokolini o‘zgartirmaydi", () => {
  const config = parseRedisRuntimeConfig({
    REDIS_KEY_PREFIX: "test",
    REDIS_URL: "redis://localhost:6379",
  });

  assert.ok(config);
  assert.equal(config.url, "redis://localhost:6379");
});

void test("Redis connection keep-alive va bounded reconnect ishlatadi", () => {
  const client = createRedisConnection(
    {
      keyPrefix: "test",
      url: "redis://localhost:6379",
    },
    "producer",
  );
  const retryStrategy = client.options.retryStrategy;

  assert.equal(client.options.keepAlive, 30_000);
  assert.equal(client.options.noDelay, true);
  assert.equal(retryStrategy?.(1), 250);
  assert.equal(retryStrategy?.(100), 5_000);
  client.disconnect(false);
});

class FakeRedis {
  readonly values = new Map<string, string>();
  private readonly counts = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    _mode: "EX" | "PX",
    _ttl: number,
    condition?: "NX",
  ): Promise<string | null> {
    if (condition === "NX" && this.values.has(key)) {
      return null;
    }

    this.values.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.values.delete(key) ? 1 : 0;
  }

  async eval(
    script: string,
    _keyCount: number,
    key: string,
    argument: string | number,
  ): Promise<unknown> {
    if (script.includes("INCR")) {
      const count = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, count);
      return [count, Number(argument)];
    }

    if (this.values.get(key) === String(argument)) {
      this.values.delete(key);
      return 1;
    }

    return 0;
  }
}

void test("Redis rate-limit bir nechta instance orasida umumiy", async () => {
  const redis = new FakeRedis();
  const config = {
    keyPrefix: "test",
    limit: 1,
    redis,
    scope: "checkout",
    windowMs: 60_000,
  } as const;
  const first = new ResilientRateLimiter(config);
  const second = new ResilientRateLimiter(config);

  assert.equal((await first.consume("user-1")).allowed, true);
  assert.equal((await second.consume("user-1")).allowed, false);
});

void test("Redis session schema bilan write/read/delete qiladi", async () => {
  const redis = new FakeRedis();
  const storage = new RedisSessionStorage({
    client: redis,
    keyPrefix: "test",
    scope: "bot",
    schema: z.object({ step: z.string() }),
    ttlSeconds: 60,
  });

  await storage.write("telegram-user-123", { step: "ready" });
  assert.deepEqual(await storage.read("telegram-user-123"), { step: "ready" });
  assert.equal(Array.from(redis.values.keys()).some((key) => key.includes("telegram-user-123")), false);
  await storage.delete("telegram-user-123");
  assert.equal(await storage.read("telegram-user-123"), undefined);
});

void test("distributed idempotency concurrent operationni bir marta bajaradi", async () => {
  const redis = new FakeRedis();
  const first = new ResilientIdempotencyStore({
    keyPrefix: "test",
    redis,
    ttlMs: 60_000,
    pollIntervalMs: 10,
    pollTimeoutMs: 500,
  });
  const second = new ResilientIdempotencyStore({
    keyPrefix: "test",
    redis,
    ttlMs: 60_000,
    pollIntervalMs: 10,
    pollTimeoutMs: 500,
  });
  let calls = 0;
  const operation = async (): Promise<{ id: number }> => {
    calls += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    return { id: 42 };
  };
  const [created, replayed] = await Promise.all([
    first.run("checkout", "request-key-123", operation),
    second.run("checkout", "request-key-123", operation),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(created.value, { id: 42 });
  assert.deepEqual(replayed.value, { id: 42 });
  assert.equal([created.replayed, replayed.replayed].filter(Boolean).length, 1);
});

void test("notification queue payload chegaralarini validatsiya qiladi", () => {
  assert.equal(
    notificationJobSchema.safeParse({
      chatId: "123456789",
      eventId: "checkout-1-customer",
      kind: "checkout_customer",
      text: "Buyurtma qabul qilindi",
    }).success,
    true,
  );
  assert.equal(
    notificationJobSchema.safeParse({
      chatId: "123",
      eventId: "invalid:event",
      kind: "checkout_customer",
      text: "x",
    }).success,
    false,
  );
});

void test("cache invalidation secret faqat aniq teng bo‘lsa qabul qilinadi", () => {
  const secret = "a-secure-cache-secret-with-32-characters";

  assert.equal(hasMatchingRevalidationSecret(secret, secret), true);
  assert.equal(hasMatchingRevalidationSecret(`${secret}-wrong`, secret), false);
  assert.equal(hasMatchingRevalidationSecret(null, secret), false);
});
