import {
  getRedisProducer,
  parseRedisRuntimeConfig,
  type RedisRuntimeConfig,
} from "@kids-store/core";

import { logger } from "./logger.js";

export const botRedisConfig: RedisRuntimeConfig | null =
  parseRedisRuntimeConfig(process.env);

export function getBotRedisProducer(): ReturnType<typeof getRedisProducer> | undefined {
  return botRedisConfig === null
    ? undefined
    : getRedisProducer(botRedisConfig);
}

export function logRedisFallback(error: unknown): void {
  logger.warn("Redis vaqtincha mavjud emas, lokal fallback ishlatilmoqda", {
    errorName: error instanceof Error ? error.name : "unknown",
  });
}
