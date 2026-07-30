import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  authenticateTelegramRequest,
  MiniAppAuthenticationError,
  TELEGRAM_INIT_DATA_HEADER,
  type TelegramAuthLogEntry,
} from "../src/lib/auth/request-auth-core.js";

const BOT_TOKEN = "123456789:test_bot_token_for_request_tests";
const OTHER_BOT_TOKEN =
  "987654321:other_bot_token_for_request_tests";
const NOW_SECONDS = 1_800_000_000;
const testUser = {
  id: 123_456_789,
  is_bot: false,
  first_name: "Test O‘g‘li",
  last_name: "User",
  username: "test_user",
  language_code: "uz",
  is_premium: true,
  photo_url: "https://example.com/test-user.jpeg",
  added_to_attachment_menu: true,
  allows_write_to_pm: true,
  future_safe_field: "must-not-leak",
};

function signInitData(
  userValue: unknown = testUser,
): string {
  const params = new URLSearchParams({
    auth_date: String(NOW_SECONDS),
    query_id: "test-query",
    user:
      typeof userValue === "string"
        ? userValue
        : JSON.stringify(userValue),
  });
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

function createAuthRequest(rawInitData?: string): Request {
  const headers = new Headers();

  if (rawInitData !== undefined) {
    headers.set(TELEGRAM_INIT_DATA_HEADER, rawInitData);
  }

  return new Request("https://kids-store.example/api/auth/me", {
    headers,
  });
}

function captureAuthentication(
  request: Request,
  botToken: string = BOT_TOKEN,
): {
  authenticate: () => ReturnType<typeof authenticateTelegramRequest>;
  logs: TelegramAuthLogEntry[];
} {
  const logs: TelegramAuthLogEntry[] = [];

  return {
    authenticate: () =>
      authenticateTelegramRequest(request, botToken, {
        log: (entry) => {
          logs.push(entry);
        },
        nowSeconds: NOW_SECONDS,
      }),
    logs,
  };
}

void test("header mavjud bo‘lmasa bitta safe log yozadi", () => {
  const attempt = captureAuthentication(createAuthRequest());

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "missing_header",
      userJsonParseSucceeded: false,
      userSchemaSucceeded: false,
      userParameterLength: 0,
    },
  ]);
});

void test("empty header alohida reasonCode qaytaradi", () => {
  const attempt = captureAuthentication(createAuthRequest(""));

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "empty_init_data",
      userJsonParseSucceeded: false,
      userSchemaSucceeded: false,
      userParameterLength: 0,
    },
  ]);
});

void test("valid initData whitelist qilingan DTO va safe log qaytaradi", () => {
  const rawInitData = signInitData();
  const attempt = captureAuthentication(
    createAuthRequest(rawInitData),
  );
  const user = attempt.authenticate();

  assert.deepEqual(user, {
    id: String(testUser.id),
    firstName: testUser.first_name,
    lastName: testUser.last_name,
    username: testUser.username,
    languageCode: testUser.language_code,
    isPremium: true,
    photoUrl: testUser.photo_url,
  });
  assert.equal("future_safe_field" in user, false);
  assert.equal("is_bot" in user, false);
  assert.equal("added_to_attachment_menu" in user, false);
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "valid",
      userJsonParseSucceeded: true,
      userSchemaSucceeded: true,
      userParameterLength: JSON.stringify(testUser).length,
    },
  ]);
});

void test("boshqa bot tokeni invalid_hash qaytaradi", () => {
  const attempt = captureAuthentication(
    createAuthRequest(signInitData()),
    OTHER_BOT_TOKEN,
  );

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "invalid_hash",
      userJsonParseSucceeded: false,
      userSchemaSucceeded: false,
      userParameterLength: JSON.stringify(testUser).length,
    },
  ]);
});

void test("malformed JSON parse diagnostikasini ajratadi", () => {
  const rawUser = "{invalid-json";
  const attempt = captureAuthentication(
    createAuthRequest(signInitData(rawUser)),
  );

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "invalid_user_json",
      userJsonParseSucceeded: false,
      userSchemaSucceeded: false,
      userParameterLength: rawUser.length,
    },
  ]);
});

void test("invalid user schema diagnostikasini ajratadi", () => {
  const invalidUser = {
    id: "123",
    first_name: "Invalid",
  };
  const attempt = captureAuthentication(
    createAuthRequest(signInitData(invalidUser)),
  );

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.deepEqual(attempt.logs, [
    {
      reasonCode: "invalid_user_schema",
      userJsonParseSucceeded: true,
      userSchemaSucceeded: false,
      userParameterLength: JSON.stringify(invalidUser).length,
    },
  ]);
});

void test("raw initData bo‘lsa initDataUnsafe.user talab qilinmaydi", () => {
  const attempt = captureAuthentication(
    createAuthRequest(signInitData()),
  );

  assert.doesNotThrow(attempt.authenticate);
  assert.equal(attempt.logs.length, 1);
  assert.equal(attempt.logs[0]?.reasonCode, "valid");
});
