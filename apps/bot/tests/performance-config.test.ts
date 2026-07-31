import assert from "node:assert/strict";
import test from "node:test";

import {
  BOT_ALLOWED_UPDATES,
  BOT_RUNNER_CONCURRENCY,
  getBotSessionKey,
} from "../src/config/performance.js";

void test("runner concurrency 10 bilan cheklangan", () => {
  assert.equal(BOT_RUNNER_CONCURRENCY, 10);
  assert.deepEqual(BOT_ALLOWED_UPDATES, ["message", "callback_query"]);
});

void test("session va sequentialize bir xil Telegram user keyini ishlatadi", () => {
  assert.equal(getBotSessionKey({ from: { id: 123_456 } }), "123456");
  assert.equal(getBotSessionKey({ from: undefined }), undefined);
});
