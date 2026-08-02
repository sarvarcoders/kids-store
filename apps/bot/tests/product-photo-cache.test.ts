import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductPhotoCache,
  type ProductPhotoCacheRedisClient,
} from "../src/services/product-photo-cache.js";

class FakeRedis implements ProductPhotoCacheRedisClient {
  readonly values = new Map<string, string>();
  getCalls = 0;

  del(key: string): Promise<number> {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }

  get(key: string): Promise<string | null> {
    this.getCalls += 1;
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string): Promise<"OK"> {
    this.values.set(key, value);
    return Promise.resolve("OK");
  }
}

const imageUrl = "https://example.com/products/test-image.jpg";
const fileId = "AgACAgIAAxkBAAIB_test-file-id_123";

void test("Telegram photo file_id Redis va lokal cache’da saqlanadi", async () => {
  const redis = new FakeRedis();
  const cache = new ProductPhotoCache({
    keyPrefix: "kids-store-test",
    redis,
  });

  await cache.set(imageUrl, fileId);
  assert.equal(await cache.get(imageUrl), fileId);
  assert.equal(redis.getCalls, 0);

  const nextInstance = new ProductPhotoCache({
    keyPrefix: "kids-store-test",
    redis,
  });
  assert.equal(await nextInstance.get(imageUrl), fileId);
  assert.equal(redis.getCalls, 1);
  assert.equal(await nextInstance.get(imageUrl), fileId);
  assert.equal(redis.getCalls, 1);
});

void test("cache faqat HTTPS rasm va xavfsiz Telegram file_id qabul qiladi", async () => {
  const cache = new ProductPhotoCache({ keyPrefix: "kids-store-test" });

  await assert.rejects(() => cache.set("http://example.com/a.jpg", fileId));
  await assert.rejects(() => cache.set(imageUrl, "short"));
});

void test("eskirgan file_id o‘chirilganda Redisdan ham tozalanadi", async () => {
  const redis = new FakeRedis();
  const cache = new ProductPhotoCache({
    keyPrefix: "kids-store-test",
    redis,
  });

  await cache.set(imageUrl, fileId);
  await cache.delete(imageUrl);
  assert.equal(await cache.get(imageUrl), null);
});
