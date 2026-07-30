import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  TelegramInitDataError,
  validateTelegramInitData,
  type TelegramInitDataFailureReasonCode,
} from "../src/lib/auth/telegram-init-data.js";

const BOT_TOKEN = "123456789:test_bot_token_for_unit_tests";
const NOW_SECONDS = 1_800_000_000;
const realisticUser = {
  id: 987_654_321,
  is_bot: false,
  first_name: "Sarvar O‘g‘li 👋",
  last_name: "Test",
  username: "sarvar_test",
  language_code: "uz",
  is_premium: true,
  photo_url: "https://example.com/telegram-user.svg",
  added_to_attachment_menu: true,
  allows_write_to_pm: true,
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

function validateUser(user: Readonly<Record<string, unknown>>) {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: JSON.stringify(user),
  });

  return validateTelegramInitData(initData, BOT_TOKEN, {
    nowSeconds: NOW_SECONDS,
  });
}

function captureInitDataError(
  action: () => unknown,
  reasonCode: TelegramInitDataFailureReasonCode,
): TelegramInitDataError {
  let caughtError: unknown;

  try {
    action();
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof TelegramInitDataError);
  assert.equal(caughtError.reasonCode, reasonCode);
  return caughtError;
}

void test("realistik valid initData WebAppUser maydonlarini qabul qiladi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS - 30),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify(realisticUser),
  });
  const result = validateTelegramInitData(initData, BOT_TOKEN, {
    nowSeconds: NOW_SECONDS,
  });

  assert.equal(result.user.id, realisticUser.id);
  assert.equal(result.user.first_name, realisticUser.first_name);
  assert.equal(result.user.is_bot, false);
  assert.equal(result.user.is_premium, true);
  assert.equal(
    result.user.added_to_attachment_menu,
    true,
  );
  assert.equal(result.user.allows_write_to_pm, true);
  assert.equal(result.queryId, "AAHdF6IQAAAAAN0XohDhrOrc");
  assert.deepEqual(result.userValidationDiagnostics, {
    userJsonParseSucceeded: true,
    userSchemaSucceeded: true,
    userParameterLength: JSON.stringify(realisticUser).length,
  });
});

void test("minimal id va first_name userni qabul qiladi", () => {
  const result = validateUser({
    id: 1,
    first_name: "Ali",
  });

  assert.equal(result.user.id, 1);
  assert.equal(result.user.first_name, "Ali");
});

void test("username va language_code maydonlarini qabul qiladi", () => {
  const result = validateUser({
    id: 2,
    first_name: "Vali",
    username: "vali_test",
    language_code: "uz-Latn",
  });

  assert.equal(result.user.username, "vali_test");
  assert.equal(result.user.language_code, "uz-Latn");
});

void test("is_premium maydonini qabul qiladi", () => {
  const result = validateUser({
    id: 3,
    first_name: "Premium",
    is_premium: true,
  });

  assert.equal(result.user.is_premium, true);
});

void test("valid photo_url maydonini qabul qiladi", () => {
  const result = validateUser({
    id: 4,
    first_name: "Photo",
    photo_url: "https://example.com/user.jpeg",
  });

  assert.equal(
    result.user.photo_url,
    "https://example.com/user.jpeg",
  );
});

void test("noto‘g‘ri optional photo_url butun authni buzmaydi", () => {
  const result = validateUser({
    id: 5,
    first_name: "No photo",
    photo_url: "not-a-url",
  });

  assert.equal(result.user.photo_url, undefined);
});

void test("added_to_attachment_menu maydonini qabul qiladi", () => {
  const result = validateUser({
    id: 6,
    first_name: "Attachment",
    added_to_attachment_menu: true,
  });

  assert.equal(result.user.added_to_attachment_menu, true);
});

void test("allows_write_to_pm maydonini qabul qiladi", () => {
  const result = validateUser({
    id: 7,
    first_name: "Write access",
    allows_write_to_pm: true,
  });

  assert.equal(result.user.allows_write_to_pm, true);
});

void test("noma’lum qo‘shimcha maydon WebAppUser parsingni buzmaydi", () => {
  const result = validateUser({
    id: 8,
    first_name: "Future",
    future_safe_field: "future-value",
  });

  assert.equal("future_safe_field" in result.user, false);
});

void test("Unicode, apostrof va emoji first_name ichida qabul qilinadi", () => {
  const firstName = "G‘anisher O’Neil 👨‍👩‍👧";
  const result = validateUser({
    id: 9,
    first_name: firstName,
  });

  assert.equal(result.user.first_name, firstName);
});

void test("URLSearchParams user qiymati qayta decode qilinmaydi", () => {
  const firstName = "Ali%20O‘g‘li";
  const result = validateUser({
    id: 10,
    first_name: firstName,
  });

  assert.equal(result.user.first_name, firstName);
});

void test("malformed user JSON invalid_user_json qaytaradi", () => {
  const rawUser = "{invalid-json";
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: rawUser,
  });
  const error = captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "invalid_user_json",
  );

  assert.deepEqual(error.userValidationDiagnostics, {
    userJsonParseSucceeded: false,
    userSchemaSucceeded: false,
    userParameterLength: rawUser.length,
  });
});

void test("schema’ga mos kelmaydigan id invalid_user_schema qaytaradi", () => {
  const rawUser = JSON.stringify({
    id: "11",
    first_name: "Invalid ID",
  });
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: rawUser,
  });
  const error = captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "invalid_user_schema",
  );

  assert.deepEqual(error.userValidationDiagnostics, {
    userJsonParseSucceeded: true,
    userSchemaSucceeded: false,
    userParameterLength: rawUser.length,
  });
});

void test("JavaScript safe integerdan katta user ID rad etiladi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: `{"id":${String(Number.MAX_SAFE_INTEGER + 1)},"first_name":"Unsafe"}`,
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "invalid_user_schema",
  );
});

void test("invalid hashni rad etadi", () => {
  const validInitData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: JSON.stringify(realisticUser),
  });
  const params = new URLSearchParams(validInitData);
  params.set("hash", "0".repeat(64));

  captureInitDataError(
    () =>
      validateTelegramInitData(params.toString(), BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "invalid_hash",
  );
});

void test("bir soatdan eski auth_dateni rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS - 3_601),
    user: JSON.stringify(realisticUser),
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "expired_auth_date",
  );
});

void test("user maydoni bo‘lmagan initDatani rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    query_id: "test-query",
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "missing_user",
  );
});

void test("duplicate parametrni alohida sabab bilan rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS),
    user: JSON.stringify(realisticUser),
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(
        `${initData}&user=${encodeURIComponent(JSON.stringify(realisticUser))}`,
        BOT_TOKEN,
        { nowSeconds: NOW_SECONDS },
      ),
    "duplicate_parameter",
  );
});

void test("hash bo‘lmasa missing_hash qaytaradi", () => {
  const params = new URLSearchParams({
    auth_date: String(NOW_SECONDS),
    user: JSON.stringify(realisticUser),
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(params.toString(), BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "missing_hash",
  );
});

void test("auth_date bo‘lmasa missing_auth_date qaytaradi", () => {
  const initData = signInitData({
    user: JSON.stringify(realisticUser),
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "missing_auth_date",
  );
});

void test("kelajakdagi auth_dateni alohida rad etadi", () => {
  const initData = signInitData({
    auth_date: String(NOW_SECONDS + 31),
    user: JSON.stringify(realisticUser),
  });

  captureInitDataError(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW_SECONDS,
      }),
    "future_auth_date",
  );
});
