import {
  botRedisConfig,
  getBotRedisProducer,
  logRedisFallback,
} from "../config/redis.js";
import { ProductPhotoCache } from "./product-photo-cache.js";

const redis = getBotRedisProducer();

export const botProductPhotoCache = new ProductPhotoCache({
  keyPrefix: botRedisConfig?.keyPrefix ?? "kids-store",
  onRedisError: logRedisFallback,
  ...(redis === undefined ? {} : { redis }),
});
