import assert from "node:assert/strict";
import {
  createHmac,
} from "node:crypto";
import test from "node:test";

import {
  TelegramInitDataError,
  validateTelegramInitData,
} from "../src/lib/auth/telegram-init-data.js";

const BOT_TOKEN = "123456789:test_bot_token_for_unit_tests";
const NOW_SECONDS = 1_800_000_000;
const user = {
  id: 987_654_321,
  first_name: "Sarvar",
  username: "sarvar_test",
  language_code: "uz",
};

function signInitData(
  entries: Readonly<Record<string, string>>,
): string {
  const params = new URLSearchParams(entries);
  const dataCheckString = Array.from(params.entries())
    .sort(([firstKey], [secondKey]) =>
      firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  params.set("hash", hash);
  return params.toString();
}

void test("valid initData verified Telegram userni qaytaradi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS - 30),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify(user),
  });
  const result = validateTelegramInitData(initData, BOT_TOKEN, {
    nowSeconds: NOW_SECONDS,
  });

  assert.equal(result.user.id, user.id);
  assert.equal(result.user.first_name, "Sarvar");
  assert.equal(result.queryId, "AAHdF6IQAAAAAN0XohDhrOrc");
});

void test("invalid hashni rad etadi", () => {
  const validInitData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: JSON.stringify(user),
  });
  const params = new URLSearchParams(validInitData);
  params.set("hash", "0".repeat(64));

  assert.throws(
    () =>
      validateTelegramInitData(params.toString(), BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    (error: unknown) =>
      error instanceof TelegramInitDataError &&
      error.code === "INVALID_HASH",
  );
});

void test("bir soatdan eski auth_dateni rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS - 3_601),
    user: JSON.stringify(user),
  });

  assert.throws(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    (error: unknown) =>
      error instanceof TelegramInitDataError &&
      error.code === "EXPIRED_AUTH_DATE",
  );
});

void test("user maydoni bo‘lmagan initDatani rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    query_id: "test-query",
  });

  assert.throws(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    (error: unknown) =>
      error instanceof TelegramInitDataError &&
      error.code === "MISSING_USER",
  );
});
