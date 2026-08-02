import { RedisSessionStorage } from "@kids-store/core";

import { botRedisConfig, getBotRedisProducer, logRedisFallback } from "../config/redis.js";
import { botSessionSchema, type BotSession } from "../types/bot-context.js";

export interface SessionStorage<TSession> {
  delete(key: string): Promise<void>;
  read(key: string): Promise<TSession | undefined>;
  write(key: string, value: TSession): Promise<void>;
}

class LocalSessionStorage<TSession> implements SessionStorage<TSession> {
  private readonly values = new Map<string, TSession>();

  constructor(private readonly maxEntries = 10_000) {}

  read(key: string): Promise<TSession | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  write(key: string, value: TSession): Promise<void> {
    this.values.delete(key);
    this.values.set(key, value);

    while (this.values.size > this.maxEntries) {
      const oldestKey = this.values.keys().next().value;

      if (typeof oldestKey !== "string") {
        break;
      }

      this.values.delete(oldestKey);
    }

    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

export class ResilientBotSessionStorage implements SessionStorage<BotSession> {
  private readonly local = new LocalSessionStorage<BotSession>();

  constructor(
    private readonly redis: SessionStorage<BotSession> | undefined,
  ) {}

  async read(key: string): Promise<BotSession | undefined> {
    const localValue = await this.local.read(key);

    if (localValue !== undefined) {
      return localValue;
    }

    if (this.redis) {
      try {
        const value = await this.redis.read(key);
        if (value !== undefined) {
          await this.local.write(key, value);
          return value;
        }
      } catch (error) {
        logRedisFallback(error);
      }
    }

    return undefined;
  }

  async write(key: string, value: BotSession): Promise<void> {
    await this.local.write(key, value);

    if (this.redis) {
      try {
        await this.redis.write(key, value);
      } catch (error) {
        logRedisFallback(error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.local.delete(key);

    if (this.redis) {
      try {
        await this.redis.delete(key);
      } catch (error) {
        logRedisFallback(error);
      }
    }
  }
}

export function createBotSessionStorage(): SessionStorage<BotSession> {
  const client = getBotRedisProducer();
  const redisStorage =
    client === undefined || botRedisConfig === null
      ? undefined
      : new RedisSessionStorage({
          client,
          keyPrefix: botRedisConfig.keyPrefix,
          schema: botSessionSchema,
          scope: "bot",
          ttlSeconds: 24 * 60 * 60,
        });

  return new ResilientBotSessionStorage(redisStorage);
}
