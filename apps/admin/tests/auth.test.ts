import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  AdminLoginError,
  validateAdminTelegramLogin,
} from "../src/lib/auth/admin-login.js";
import {
  createAdminSessionToken,
  getAdminSessionCookiePolicy,
  isAdminAllowed,
  verifyAdminSessionToken,
  verifyCsrfToken,
} from "../src/lib/auth/session-core.js";
import { adminTelegramIdsSchema } from "@kids-store/shared";

const botToken = "123456:TEST_TOKEN";
const sessionSecret =
  "test-session-secret-with-at-least-thirty-two-characters";

function createInitData(
  user: Record<string, unknown>,
  nowSeconds = 1_800_000_000,
): string {
  const params = new URLSearchParams({
    auth_date: String(nowSeconds),
    query_id: "test-query",
    user: JSON.stringify(user),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

void test("allowlist duplicate IDlarni bitta admin sifatida tekshiradi", () => {
  assert.deepEqual(
    adminTelegramIdsSchema.parse("123, 123,456"),
    ["123", "456"],
  );
  assert.equal(isAdminAllowed("123", ["123", "123", "456"]), true);
  assert.equal(isAdminAllowed("999", ["123", "456"]), false);
});

void test("server tasdiqlagan allowlist adminini qabul qiladi", () => {
  const identity = validateAdminTelegramLogin({
    initData: createInitData({
      id: 123,
      first_name: "Sarvar",
      username: "sarvar_admin",
    }),
    botToken,
    allowedIds: ["123", "456"],
    nowSeconds: 1_800_000_000,
  });

  assert.deepEqual(identity, {
    adminTelegramId: "123",
    firstName: "Sarvar",
    username: "sarvar_admin",
  });
});

void test("allowlistda bo‘lmagan Telegram user 403 domen xatosini oladi", () => {
  assert.throws(
    () =>
      validateAdminTelegramLogin({
        initData: createInitData({
          id: 999,
          first_name: "Begona",
        }),
        botToken,
        allowedIds: ["123"],
        nowSeconds: 1_800_000_000,
      }),
    (error) =>
      error instanceof AdminLoginError && error.code === "FORBIDDEN",
  );
});

void test("imzolangan session valid, buzilgan va expired session invalid", () => {
  const { token, session } = createAdminSessionToken(
    {
      adminTelegramId: "123",
      firstName: "Sarvar",
    },
    sessionSecret,
    1_800_000_000,
  );

  assert.equal(
    verifyAdminSessionToken(token, sessionSecret, 1_800_000_100)
      ?.adminTelegramId,
    "123",
  );
  assert.equal(
    verifyAdminSessionToken(
      `${token.slice(0, -1)}x`,
      sessionSecret,
      1_800_000_100,
    ),
    null,
  );
  assert.equal(
    verifyAdminSessionToken(
      token,
      sessionSecret,
      session.expiresAt,
    ),
    null,
  );
  assert.equal(
    verifyCsrfToken(session.csrfToken, session.csrfToken),
    true,
  );
  assert.equal(verifyCsrfToken(session.csrfToken, "x".repeat(32)), false);
});

void test("production session cookie Telegram Web iframe ichida ishlaydi", () => {
  assert.deepEqual(getAdminSessionCookiePolicy("production"), {
    httpOnly: true,
    partitioned: true,
    path: "/",
    sameSite: "none",
    secure: true,
  });
});

void test("local session cookie HTTPS talab qilmaydi", () => {
  assert.deepEqual(getAdminSessionCookiePolicy("development"), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
});

void test("session cookie policy noma'lum environmentni rad etadi", () => {
  assert.throws(() => getAdminSessionCookiePolicy("preview"));
});
