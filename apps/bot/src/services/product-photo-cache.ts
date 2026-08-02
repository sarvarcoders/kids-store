import { createHash } from "node:crypto";

import { z } from "zod";

const productPhotoCacheConfigSchema = z.object({
  keyPrefix: z.string().trim().min(1).max(40),
  maxEntries: z.number().int().min(1).max(2_000).default(256),
  ttlSeconds: z
    .number()
    .int()
    .min(60)
    .max(90 * 24 * 60 * 60)
    .default(30 * 24 * 60 * 60),
});
const productImageUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => value.startsWith("https://"));
const telegramFileIdSchema = z
  .string()
  .trim()
  .min(10)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export interface ProductPhotoCacheRedisClient {
  del(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "EX",
    ttlSeconds: number,
  ): Promise<unknown>;
}

export interface ProductPhotoCacheOptions {
  keyPrefix: string;
  maxEntries?: number;
  onRedisError?: (error: unknown) => void;
  redis?: ProductPhotoCacheRedisClient;
  ttlSeconds?: number;
}

export class ProductPhotoCache {
  private readonly keyPrefix: string;
  private readonly maxEntries: number;
  private readonly memory = new Map<string, string>();
  private readonly onRedisError: ((error: unknown) => void) | undefined;
  private readonly redis: ProductPhotoCacheRedisClient | undefined;
  private readonly ttlSeconds: number;

  constructor(optionsInput: ProductPhotoCacheOptions) {
    const options = productPhotoCacheConfigSchema.parse(optionsInput);

    this.keyPrefix = options.keyPrefix;
    this.maxEntries = options.maxEntries;
    this.onRedisError = optionsInput.onRedisError;
    this.redis = optionsInput.redis;
    this.ttlSeconds = options.ttlSeconds;
  }

  async get(imageUrlInput: unknown): Promise<string | null> {
    const cacheKey = this.cacheKey(imageUrlInput);
    const memoryValue = this.memory.get(cacheKey);

    if (memoryValue) {
      this.remember(cacheKey, memoryValue);
      return memoryValue;
    }

    if (!this.redis) {
      return null;
    }

    try {
      const redisValue = await this.redis.get(cacheKey);
      const parsedValue = telegramFileIdSchema.safeParse(redisValue);

      if (!parsedValue.success) {
        return null;
      }

      this.remember(cacheKey, parsedValue.data);
      return parsedValue.data;
    } catch (error) {
      this.onRedisError?.(error);
      return null;
    }
  }

  async set(imageUrlInput: unknown, fileIdInput: unknown): Promise<void> {
    const cacheKey = this.cacheKey(imageUrlInput);
    const fileId = telegramFileIdSchema.parse(fileIdInput);
    this.remember(cacheKey, fileId);

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(cacheKey, fileId, "EX", this.ttlSeconds);
    } catch (error) {
      this.onRedisError?.(error);
    }
  }

  async delete(imageUrlInput: unknown): Promise<void> {
    const cacheKey = this.cacheKey(imageUrlInput);
    this.memory.delete(cacheKey);

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      this.onRedisError?.(error);
    }
  }

  private cacheKey(imageUrlInput: unknown): string {
    const imageUrl = productImageUrlSchema.parse(imageUrlInput);
    const digest = createHash("sha256").update(imageUrl).digest("hex");

    return `${this.keyPrefix}:telegram-photo:${digest}`;
  }

  private remember(cacheKey: string, fileId: string): void {
    this.memory.delete(cacheKey);
    this.memory.set(cacheKey, fileId);

    while (this.memory.size > this.maxEntries) {
      const oldestKey = this.memory.keys().next().value;

      if (typeof oldestKey !== "string") {
        break;
      }

      this.memory.delete(oldestKey);
    }
  }
}
