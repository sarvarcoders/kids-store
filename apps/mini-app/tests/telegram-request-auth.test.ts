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
const OTHER_BOT_TOKEN = "987654321:other_bot_token_for_request_tests";
const NOW_SECONDS = 1_800_000_000;
const testUser = {
  id: 123_456_789,
  first_name: "Test",
  username: "test_user",
};

function signInitData(): string {
  const params = new URLSearchParams({
    auth_date: String(NOW_SECONDS),
    query_id: "test-query",
    user: JSON.stringify(testUser),
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
  assert.equal(attempt.logs.length, 1);
  assert.deepEqual(attempt.logs[0], {
    event: "telegram_auth",
    path: "/api/auth/me",
    headerPresent: false,
    initDataLength: 0,
    hashPresent: false,
    authDatePresent: false,
    userParameterPresent: false,
    reasonCode: "missing_header",
  });
});

void test("empty header alohida reasonCode qaytaradi", () => {
  const attempt = captureAuthentication(createAuthRequest(""));

  assert.throws(
    attempt.authenticate,
    MiniAppAuthenticationError,
  );
  assert.equal(attempt.logs.length, 1);
  const [entry] = attempt.logs;
  assert.ok(entry);
  assert.equal(entry.reasonCode, "empty_init_data");
  assert.equal(entry.headerPresent, true);
  assert.equal(entry.initDataLength, 0);
});

void test("valid initData userni tasdiqlab bitta valid log yozadi", () => {
  const rawInitData = signInitData();
  const attempt = captureAuthentication(
    createAuthRequest(rawInitData),
  );
  const user = attempt.authenticate();

  assert.equal(user.id, String(testUser.id));
  assert.equal(user.isDevelopmentMock, false);
  assert.equal(attempt.logs.length, 1);
  const [entry] = attempt.logs;
  assert.ok(entry);
  assert.equal(entry.reasonCode, "valid");
  assert.equal(entry.headerPresent, true);
  assert.equal(entry.initDataLength, rawInitData.length);
  assert.equal(entry.hashPresent, true);
  assert.equal(entry.authDatePresent, true);
  assert.equal(entry.userParameterPresent, true);
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
  assert.equal(attempt.logs.length, 1);
  assert.equal(attempt.logs[0]?.reasonCode, "invalid_hash");
});

void test("raw initData bo‘lsa initDataUnsafe.user talab qilinmaydi", () => {
  const attempt = captureAuthentication(
    createAuthRequest(signInitData()),
  );

  assert.doesNotThrow(attempt.authenticate);
  assert.equal(attempt.logs.length, 1);
  assert.equal(attempt.logs[0]?.reasonCode, "valid");
});
