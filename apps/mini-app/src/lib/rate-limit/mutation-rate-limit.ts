import "server-only";

import { ResilientRateLimiter } from "@kids-store/core";
import { z } from "zod";

const rateLimitScopeSchema = z.enum(["cart", "checkout"]);
const userIdSchema = z.string().regex(/^[1-9]\d*$/);
import {
  getMiniAppRedisProducer,
  logMiniAppRedisFallback,
  miniAppRedisConfig,
} from "../redis/server";

const redis = getMiniAppRedisProducer();
const keyPrefix = miniAppRedisConfig?.keyPrefix ?? "kids-store";
const cartMutationLimiter = new ResilientRateLimiter({
  keyPrefix,
  limit: 12,
  onRedisError: logMiniAppRedisFallback,
  redis: redis ?? null,
  scope: "mini-cart",
  windowMs: 10_000,
});
const checkoutLimiter = new ResilientRateLimiter({
  keyPrefix,
  limit: 3,
  onRedisError: logMiniAppRedisFallback,
  redis: redis ?? null,
  scope: "mini-checkout",
  windowMs: 60_000,
});

export async function consumeMutationPermit(
  scopeInput: unknown,
  userIdInput: unknown,
): Promise<boolean> {
  const scope = rateLimitScopeSchema.parse(scopeInput);
  const userId = userIdSchema.parse(userIdInput);
  const key = `${scope}:${userId}`;

  const decision = await (scope === "cart"
    ? cartMutationLimiter.consume(key)
    : checkoutLimiter.consume(key));

  return decision.allowed;
}
