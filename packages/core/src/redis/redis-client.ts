import { Redis } from "ioredis";
import { z } from "zod";

const UPSTASH_HOST_SUFFIX = ".upstash.io";

function normalizeRedisUrl(value: string): string {
  const url = new URL(value);
  const isUpstashHost =
    url.hostname === "upstash.io" ||
    url.hostname.endsWith(UPSTASH_HOST_SUFFIX);

  if (isUpstashHost && url.protocol === "redis:") {
    return value.replace(/^redis:\/\//i, "rediss://");
  }

  return value;
}

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
    .transform(normalizeRedisUrl)
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
    keepAlive: 30_000,
    lazyConnect: true,
    maxRetriesPerRequest: mode === "worker" ? null : 1,
    noDelay: true,
    retryStrategy(attempt: number) {
      return Math.min(250 * 2 ** Math.min(attempt - 1, 5), 5_000);
    },
  });

  client.on("error", () => undefined);

  return client;
}

export function getRedisProducer(
  config: RedisRuntimeConfig,
): Redis {
  const existing = producerConnections.get(config.url);

  if (existing && existing.status !== "end") {
    return existing;
  }

  if (existing) {
    producerConnections.delete(config.url);
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
