import "server-only";

import {
  getRedisProducer,
  parseRedisRuntimeConfig,
  type RedisRuntimeConfig,
} from "@kids-store/core";

import { logServerError } from "../api/response";

export const miniAppRedisConfig: RedisRuntimeConfig | null =
  parseRedisRuntimeConfig(process.env);

export function getMiniAppRedisProducer(): ReturnType<typeof getRedisProducer> | undefined {
  return miniAppRedisConfig === null
    ? undefined
    : getRedisProducer(miniAppRedisConfig);
}

export function logMiniAppRedisFallback(error: unknown): void {
  logServerError("redis-fallback", error);
}
