import assert from "node:assert/strict";
import test from "node:test";

import { sendTelegramTextMessage } from "../src/telegram/send-message.js";

const input = {
  botToken: "123456:valid_test_token",
  chatId: "123456",
  text: "Sinov xabari",
};

void test("Telegram 429 javobidan keyin retry_after bilan qayta urinadi", async () => {
  let requestCount = 0;
  const delays: number[] = [];
  const fetcher: typeof fetch = () => {
    requestCount += 1;

    return Promise.resolve(
      requestCount === 1
        ? new Response(
            JSON.stringify({
              ok: false,
              parameters: { retry_after: 1 },
            }),
            { status: 429 },
          )
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  };

  await sendTelegramTextMessage(input, {
    fetcher,
    sleep(delayMs) {
      delays.push(delayMs);
      return Promise.resolve();
    },
  });

  assert.equal(requestCount, 2);
  assert.deepEqual(delays, [1_000]);
});

void test("Telegram 500 xatosida exponential backoff ishlaydi", async () => {
  let requestCount = 0;
  const delays: number[] = [];
  const fetcher: typeof fetch = () => {
    requestCount += 1;

    return Promise.resolve(
      requestCount < 3
        ? new Response(JSON.stringify({ ok: false }), { status: 500 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  };

  await sendTelegramTextMessage(input, {
    baseDelayMs: 10,
    fetcher,
    sleep(delayMs) {
      delays.push(delayMs);
      return Promise.resolve();
    },
  });

  assert.equal(requestCount, 3);
  assert.deepEqual(delays, [10, 20]);
});

void test("Telegram 400 javobi retry qilinmaydi", async () => {
  let requestCount = 0;
  const fetcher: typeof fetch = () => {
    requestCount += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ ok: false }), { status: 400 }),
    );
  };

  await assert.rejects(
    sendTelegramTextMessage(input, {
      fetcher,
      sleep: () => Promise.resolve(),
    }),
    /TELEGRAM_MESSAGE_REJECTED/,
  );
  assert.equal(requestCount, 1);
});
