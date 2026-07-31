import { Redis } from "ioredis";
import { z } from "zod";

const optionalRedisUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;

      return protocol === "redis:" || protocol === "rediss:";
    }, "REDIS_URL redis:// yoki rediss:// formatida bo‘lishi kerak")
    .optional(),
);
const redisEnvironmentSchema = z.object({
  REDIS_URL: optionalRedisUrlSchema,
  REDIS_KEY_PREFIX: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .default("kids-store"),
});

export interface RedisRuntimeConfig {
  keyPrefix: string;
  url: string;
}

export type RedisConnectionMode = "producer" | "worker";

const producerConnections = new Map<string, Redis>();

export function parseRedisRuntimeConfig(
  environment: Record<string, string | undefined>,
): RedisRuntimeConfig | null {
  const parsed = redisEnvironmentSchema.parse(environment);

  return parsed.REDIS_URL === undefined
    ? null
    : {
        keyPrefix: parsed.REDIS_KEY_PREFIX,
        url: parsed.REDIS_URL,
      };
}

export function createRedisConnection(
  config: RedisRuntimeConfig,
  mode: RedisConnectionMode,
): Redis {
  const client = new Redis(config.url, {
    connectionName: `kids-store-${mode}`,
    connectTimeout: 5_000,
    enableOfflineQueue: true,
    lazyConnect: true,
    maxRetriesPerRequest: mode === "worker" ? null : 1,
    retryStrategy(attempt: number) {
      if (mode === "producer" && attempt > 3) {
        return null;
      }

      return Math.min(250 * 2 ** Math.min(attempt - 1, 6), 20_000);
    },
  });

  client.on("error", () => undefined);

  return client;
}

export function getRedisProducer(
  config: RedisRuntimeConfig,
): Redis {
  const existing = producerConnections.get(config.url);

  if (existing) {
    return existing;
  }

  const client = createRedisConnection(config, "producer");
  producerConnections.set(config.url, client);

  return client;
}

export async function closeRedisProducers(): Promise<void> {
  const clients = [...producerConnections.values()];
  producerConnections.clear();

  await Promise.allSettled(
    clients.map(async (client) => {
      if (client.status === "end") {
        return;
      }

      await client.quit();
    }),
  );
}
