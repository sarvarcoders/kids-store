import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  runIdempotentMutation,
} from "../src/lib/security/idempotency.js";
import {
  assertRateLimit,
  resetRateLimitsForTests,
} from "../src/lib/security/rate-limit.js";

void test("bir xil mutation key concurrent double submitni bir marta bajaradi", async () => {
  let calls = 0;
  const operation = async (): Promise<{ id: number }> => {
    calls += 1;
    await Promise.resolve();
    return { id: 10 };
  };
  const [first, second] = await Promise.all([
    runIdempotentMutation("test", "abcdefghijklmnop", operation),
    runIdempotentMutation("test", "abcdefghijklmnop", operation),
  ]);

  assert.deepEqual(first, second);
  assert.equal(calls, 1);
});

void test("rate limit ortiqcha mutationni bloklaydi", async () => {
  resetRateLimitsForTests();
  await assert.doesNotReject(async () =>
    { await assertRateLimit({
      key: "admin:1",
      limit: 1,
      nowMs: 1_000,
      windowMs: 1_000,
    }); },
  );
  await assert.rejects(
    async () =>
      { await assertRateLimit({
        key: "admin:1",
        limit: 1,
        nowMs: 1_001,
        windowMs: 1_000,
      }); },
    /RATE_LIMIT_EXCEEDED/,
  );
});

void test("client komponentlarda server secret nomlari ishlatilmaydi", () => {
  const files = [
    "../src/components/auth/admin-auth-provider.tsx",
    "../src/components/auth/login-panel.tsx",
    "../src/components/layout/admin-shell.tsx",
  ];

  files.forEach((file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /TELEGRAM_BOT_TOKEN|DATABASE_URL|DIRECT_URL|ADMIN_SESSION_SECRET/,
    );
  });
});
