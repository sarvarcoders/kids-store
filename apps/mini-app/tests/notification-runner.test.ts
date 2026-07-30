import assert from "node:assert/strict";
import test from "node:test";

import {
  runNotificationSafely,
} from "../src/lib/checkout/notification-runner.js";

void test("notification xatosi checkout natijasini rad etmaydi", async () => {
  let loggedError: unknown;

  await assert.doesNotReject(() =>
    runNotificationSafely(
      () => Promise.reject(new Error("Telegram unavailable")),
      (error) => {
        loggedError = error;
      },
    ),
  );
  assert.ok(loggedError instanceof Error);
});
