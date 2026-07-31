import {
  getRedisProducer,
  parseRedisRuntimeConfig,
  type RedisRuntimeConfig,
} from "@kids-store/core";

export const adminRedisConfig: RedisRuntimeConfig | null =
  parseRedisRuntimeConfig(process.env);

export function getAdminRedisProducer(): ReturnType<typeof getRedisProducer> | undefined {
  return adminRedisConfig === null
    ? undefined
    : getRedisProducer(adminRedisConfig);
}

export function logAdminRedisFallback(error: unknown): void {
  console.warn(
    JSON.stringify({
      event: "admin_redis_fallback",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  );
}
