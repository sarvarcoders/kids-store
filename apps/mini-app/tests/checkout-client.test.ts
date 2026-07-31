import assert from "node:assert/strict";
import test from "node:test";

import { validateCheckoutDraft } from "../src/lib/cart/checkout-client.js";

const idempotencyKey = "26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed";

void test("checkout client telefoni server formatiga keltiriladi", () => {
  const result = validateCheckoutDraft({
    phone: "90 123-45-67",
    deliveryAddress: "Toshkent shahri, Chilonzor 1",
    idempotencyKey,
  });

  assert.ok(result.success);
  assert.equal(result.data.phone, "+998901234567");
  assert.equal(result.data.deliveryAddress, "Toshkent shahri, Chilonzor 1");
});

void test("checkout client noto‘g‘ri telefon, manzil va UUIDni rad etadi", () => {
  assert.equal(
    validateCheckoutDraft({
      phone: "123",
      deliveryAddress: "Toshkent shahri",
      idempotencyKey,
    }).success,
    false,
  );
  assert.equal(
    validateCheckoutDraft({
      phone: "+998901234567",
      deliveryAddress: "Uy",
      idempotencyKey,
    }).success,
    false,
  );
  assert.equal(
    validateCheckoutDraft({
      phone: "+998901234567",
      deliveryAddress: "Toshkent shahri",
      idempotencyKey: "invalid",
    }).success,
    false,
  );
});
