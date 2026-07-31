import { ResilientIdempotencyStore } from "@kids-store/core";

import {
  adminRedisConfig,
  getAdminRedisProducer,
  logAdminRedisFallback,
} from "../redis/server";

const redis = getAdminRedisProducer();
const store = new ResilientIdempotencyStore({
  keyPrefix: adminRedisConfig?.keyPrefix ?? "kids-store",
  onRedisError: logAdminRedisFallback,
  ...(redis === undefined ? {} : { redis }),
  ttlMs: 10 * 60 * 1_000,
});

export async function runIdempotentMutation<T>(
  scope: string,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  return (await store.run(scope, key, operation)).value;
}
