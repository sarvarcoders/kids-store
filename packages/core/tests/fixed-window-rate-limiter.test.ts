import assert from "node:assert/strict";
import test from "node:test";

import { FixedWindowRateLimiter } from "../src/rate-limit/fixed-window.js";

void test("bir user limitdan oshganda bloklanadi va yangi oynada tiklanadi", () => {
  const limiter = new FixedWindowRateLimiter({
    limit: 2,
    windowMs: 1_000,
  });

  assert.equal(limiter.consume("user:1", 0), true);
  assert.equal(limiter.consume("user:1", 10), true);
  assert.equal(limiter.consume("user:1", 20), false);
  assert.equal(limiter.consume("user:1", 1_000), true);
});

void test("10, 100 va 1000 ta user bir-birining limitiga ta'sir qilmaydi", () => {
  for (const userCount of [10, 100, 1_000]) {
    const limiter = new FixedWindowRateLimiter({
      limit: 1,
      windowMs: 1_000,
      maxEntries: userCount,
    });
    const results = Array.from({ length: userCount }, (_, index) =>
      limiter.consume(`user:${String(index + 1)}`, 0),
    );

    assert.equal(results.every(Boolean), true);
  }
});
