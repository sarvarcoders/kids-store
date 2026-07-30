import assert from "node:assert/strict";
import test from "node:test";

import { runNotificationSafely } from "@kids-store/core";

import {
  canTransitionOrderStatus,
  getAllowedOrderStatuses,
  shouldRestoreStock,
} from "../src/lib/orders/order-transitions.js";

void test("to‘g‘ri va noto‘g‘ri order transitionlarni ajratadi", () => {
  assert.equal(
    canTransitionOrderStatus("PENDING", "CONFIRMED"),
    true,
  );
  assert.equal(
    canTransitionOrderStatus("CONFIRMED", "PROCESSING"),
    true,
  );
  assert.equal(
    canTransitionOrderStatus("DELIVERED", "PENDING"),
    false,
  );
  assert.equal(
    canTransitionOrderStatus("CANCELLED", "CONFIRMED"),
    false,
  );
});

void test("cancel stockni faqat birinchi ruxsatli o‘tishda qaytaradi", () => {
  assert.equal(shouldRestoreStock("PENDING", "CANCELLED"), true);
  assert.equal(shouldRestoreStock("CONFIRMED", "CANCELLED"), true);
  assert.equal(shouldRestoreStock("CANCELLED", "CANCELLED"), false);
  assert.equal(shouldRestoreStock("SHIPPED", "CANCELLED"), false);
});

void test("bir xil status update idempotent va allowed ro‘yxatda qoladi", () => {
  assert.equal(
    canTransitionOrderStatus("CONFIRMED", "CONFIRMED"),
    true,
  );
  assert.deepEqual(getAllowedOrderStatuses("DELIVERED"), [
    "DELIVERED",
  ]);
});

void test("Telegram notification xatosi status natijasini rollback qilmaydi", async () => {
  let logged = false;
  const delivered = await runNotificationSafely(
    () => Promise.reject(new Error("Telegram unavailable")),
    () => {
      logged = true;
    },
  );

  assert.equal(delivered, false);
  assert.equal(logged, true);
});
