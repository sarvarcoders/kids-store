import { createHash } from "node:crypto";

import { z } from "zod";

const storageConfigSchema = z.object({
  keyPrefix: z.string().trim().min(1).max(40),
  scope: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/),
  ttlSeconds: z.number().int().positive().max(30 * 24 * 60 * 60),
});
const sessionKeySchema = z.string().trim().min(1).max(300);

export interface RedisSessionClient {
  del(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
}

export interface RedisSessionStorageConfig<TSession> {
  client: RedisSessionClient;
  keyPrefix: string;
  scope: string;
  schema: z.ZodType<TSession>;
  ttlSeconds: number;
}

/**
 * A small structural adapter that is compatible with grammY StorageAdapter.
 * Session keys are hashed so Telegram identifiers are not exposed in Redis.
 */
export class RedisSessionStorage<TSession> {
  private readonly client: RedisSessionClient;
  private readonly keyPrefix: string;
  private readonly schema: z.ZodType<TSession>;
  private readonly scope: string;
  private readonly ttlSeconds: number;

  constructor(input: RedisSessionStorageConfig<TSession>) {
    const config = storageConfigSchema.parse(input);

    this.client = input.client;
    this.keyPrefix = config.keyPrefix;
    this.schema = input.schema;
    this.scope = config.scope;
    this.ttlSeconds = config.ttlSeconds;
  }

  async read(keyInput: string): Promise<TSession | undefined> {
    const stored = await this.client.get(this.storageKey(keyInput));

    if (stored === null) {
      return undefined;
    }

    return this.schema.parse(JSON.parse(stored));
  }

  async write(keyInput: string, valueInput: TSession): Promise<void> {
    const value = this.schema.parse(valueInput);

    await this.client.set(
      this.storageKey(keyInput),
      JSON.stringify(value),
      "EX",
      this.ttlSeconds,
    );
  }

  async delete(keyInput: string): Promise<void> {
    await this.client.del(this.storageKey(keyInput));
  }

  private storageKey(keyInput: string): string {
    const key = sessionKeySchema.parse(keyInput);
    const digest = createHash("sha256").update(key).digest("hex");

    return `${this.keyPrefix}:session:${this.scope}:${digest}`;
  }
}
