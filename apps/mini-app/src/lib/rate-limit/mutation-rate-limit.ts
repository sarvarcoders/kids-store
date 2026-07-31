import "server-only";

import { FixedWindowRateLimiter } from "@kids-store/core";
import { z } from "zod";

const rateLimitScopeSchema = z.enum(["cart", "checkout"]);
const userIdSchema = z.string().regex(/^[1-9]\d*$/);
const cartMutationLimiter = new FixedWindowRateLimiter({
  limit: 12,
  windowMs: 10_000,
});
const checkoutLimiter = new FixedWindowRateLimiter({
  limit: 3,
  windowMs: 60_000,
});

export function consumeMutationPermit(
  scopeInput: unknown,
  userIdInput: unknown,
): boolean {
  const scope = rateLimitScopeSchema.parse(scopeInput);
  const userId = userIdSchema.parse(userIdInput);
  const key = `${scope}:${userId}`;

  return scope === "cart"
    ? cartMutationLimiter.consume(key)
    : checkoutLimiter.consume(key);
}
