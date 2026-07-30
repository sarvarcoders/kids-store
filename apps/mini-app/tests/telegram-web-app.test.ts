import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeTelegramWebApp,
  type TelegramInitializationResult,
} from "../src/lib/telegram/web-app.js";

interface MockTelegramWebApp {
  calls: {
    expand: number;
    ready: number;
  };
  webApp: TelegramWebApp;
}

function createMockTelegramWebApp({
  initData,
  platform,
}: {
  initData: string;
  platform: string;
}): MockTelegramWebApp {
  const calls = {
    expand: 0,
    ready: 0,
  };
  const webApp: TelegramWebApp = {
    BackButton: {
      hide() {
        return undefined;
      },
      offClick() {
        return undefined;
      },
      onClick() {
        return undefined;
      },
      show() {
        return undefined;
      },
    },
    colorScheme: "light",
    expand() {
      calls.expand += 1;
    },
    initData,
    offEvent() {
      return undefined;
    },
    onEvent() {
      return undefined;
    },
    platform,
    ready() {
      calls.ready += 1;
    },
  };

  return {
    calls,
    webApp,
  };
}

function skipWait(): Promise<void> {
  return Promise.resolve();
}

async function initializeWithMock(
  getWebApp: () => TelegramWebApp | null,
): Promise<TelegramInitializationResult> {
  return initializeTelegramWebApp({
    getWebApp,
    intervalMs: 10,
    timeoutMs: 20,
    wait: skipWait,
  });
}

void test("SDK kech yuklansa WebApp va initData kelishini kutadi", async () => {
  const mock = createMockTelegramWebApp({
    initData: "query_id=test&user=%7B%22id%22%3A1%7D",
    platform: "android",
  });
  let sdkReads = 0;
  const result = await initializeWithMock(() => {
    sdkReads += 1;

    return sdkReads < 2 ? null : mock.webApp;
  });

  assert.equal(result.status, "ready");
  assert.equal(result.initData, mock.webApp.initData);
  assert.equal(mock.calls.ready, 1);
  assert.equal(mock.calls.expand, 1);
});

void test("mavjud initData authenticated holatni qaytaradi", async () => {
  const mock = createMockTelegramWebApp({
    initData: "auth_date=1&user=%7B%22id%22%3A1%7D&hash=test",
    platform: "ios",
  });
  const result = await initializeWithMock(() => mock.webApp);

  assert.equal(result.status, "ready");
  assert.equal(result.diagnostics.hasTelegramObject, true);
  assert.equal(result.diagnostics.hasInitData, true);
  assert.equal(result.diagnostics.hasUserField, true);
});

void test("WebApp avval bo‘sh bo‘lsa initData kelishini kutadi", async () => {
  const mock = createMockTelegramWebApp({
    initData: "",
    platform: "android",
  });
  let sdkReads = 0;
  const result = await initializeWithMock(() => {
    sdkReads += 1;

    if (sdkReads === 2) {
      mock.webApp.initData =
        "auth_date=1&user=%7B%22id%22%3A1%7D&hash=test";
    }

    return mock.webApp;
  });

  assert.equal(result.status, "ready");
  assert.equal(result.diagnostics.hasInitData, true);
  assert.equal(mock.calls.ready, 1);
  assert.equal(mock.calls.expand, 1);
});

void test("Telegram WebView initData bermasa aniq holat qaytaradi", async () => {
  const mock = createMockTelegramWebApp({
    initData: "",
    platform: "tdesktop",
  });
  const result = await initializeWithMock(() => mock.webApp);

  assert.equal(result.status, "missing-init-data");
  assert.equal(result.initData, "");
  assert.equal(result.diagnostics.hasTelegramObject, true);
  assert.equal(result.diagnostics.hasInitData, false);
  assert.equal(result.diagnostics.hasUserField, false);
});

void test("oddiy browser Telegram WebViewdan alohida aniqlanadi", async () => {
  const mock = createMockTelegramWebApp({
    initData: "",
    platform: "unknown",
  });
  const result = await initializeWithMock(() => mock.webApp);

  assert.equal(result.status, "browser");
  assert.equal(result.diagnostics.hasTelegramObject, true);
  assert.equal(result.diagnostics.hasInitData, false);
});
