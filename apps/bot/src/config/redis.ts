import {
  getRedisProducer,
  parseRedisRuntimeConfig,
  type RedisRuntimeConfig,
} from "@kids-store/core";

import { logger } from "./logger.js";

const REDIS_LOG_INTERVAL_MS = 60_000;

type RedisLogScope = "fallback" | "worker";

interface RedisLogState {
  lastLoggedAt: number;
  suppressedErrors: number;
}

const redisLogStates: Record<RedisLogScope, RedisLogState> = {
  fallback: { lastLoggedAt: 0, suppressedErrors: 0 },
  worker: { lastLoggedAt: 0, suppressedErrors: 0 },
};

export const botRedisConfig: RedisRuntimeConfig | null =
  parseRedisRuntimeConfig(process.env);

export function getBotRedisProducer(): ReturnType<typeof getRedisProducer> | undefined {
  return botRedisConfig === null
    ? undefined
    : getRedisProducer(botRedisConfig);
}

export function logRedisFallback(error: unknown): void {
  logRedisIssue(
    "fallback",
    "Redis vaqtincha mavjud emas, lokal fallback ishlatilmoqda",
    error,
  );
}

export function logRedisWorkerError(error: unknown): void {
  logRedisIssue(
    "worker",
    "Notification queue Redis ulanishida vaqtinchalik xato",
    error,
  );
}

function logRedisIssue(
  scope: RedisLogScope,
  message: string,
  error: unknown,
): void {
  const state = redisLogStates[scope];
  const now = Date.now();

  if (now - state.lastLoggedAt < REDIS_LOG_INTERVAL_MS) {
    state.suppressedErrors += 1;
    return;
  }

  logger.warn(message, {
    errorCode: getRedisErrorCode(error),
    errorName: error instanceof Error ? error.name : "UnknownError",
    suppressedErrors: state.suppressedErrors,
  });
  state.lastLoggedAt = now;
  state.suppressedErrors = 0;
}

function getRedisErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "unknown";
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : "unknown";
}
