import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { CreateOrderInput } from "@kids-store/shared";

import type {
  CreatedOrder,
  OrderRepository,
  OrderTransaction,
} from "../src/services/order.repository.js";
import {
  OrderService,
  OrderServiceError,
  createOrderInTransaction,
} from "../src/services/order.service.js";

const baseInput: CreateOrderInput = {
  productVariantId: 10,
  quantity: 1,
  deliveryAddress: "Toshkent shahri, Chilonzor tumani, 1-uy",
  idempotencyKey: randomUUID(),
  customer: {
    telegramUserId: 123_456n,
    username: "test_customer",
    firstName: "Test",
    phone: "+998901234567",
  },
};

function createOrderRecord(idempotencyInput: CreateOrderInput): CreatedOrder {
  return {
    id: 100,
    status: "PENDING",
    totalAmount: 199_000,
    deliveryAddress: idempotencyInput.deliveryAddress,
    customer: {
      telegramUserId: idempotencyInput.customer.telegramUserId,
      username: idempotencyInput.customer.username ?? null,
      firstName: idempotencyInput.customer.firstName,
      phone: idempotencyInput.customer.phone,
    },
    item: {
      quantity: idempotencyInput.quantity,
      unitPrice: 199_000,
      productVariantId: idempotencyInput.productVariantId,
      size: "98",
      color: "Ko‘k",
      productId: 1,
      productName: "Bolalar uchun sport kostyumi",
    },
  };
}

void test("parallel buyurtmalarda stock faqat bir marta kamayadi", async () => {
  let stock = 1;
  let variantReadCount = 0;
  let releaseVariantReads: (() => void) | undefined;
  const bothVariantsRead = new Promise<void>((resolve) => {
    releaseVariantReads = resolve;
  });
  let createdOrderCount = 0;

  const transaction: OrderTransaction = {
    async findVariant() {
      variantReadCount += 1;

      if (variantReadCount === 2) {
        releaseVariantReads?.();
      }

      await bothVariantsRead;

      return {
        id: 10,
        size: "98",
        color: "Ko‘k",
        stock,
        product: {
          id: 1,
          name: "Bolalar uchun sport kostyumi",
          price: 249_000,
          discountPrice: 199_000,
          isActive: true,
        },
      };
    },
    reserveStock(_productVariantId, quantity) {
      if (stock < quantity) {
        return Promise.resolve(false);
      }

      stock -= quantity;
      return Promise.resolve(true);
    },
    upsertCustomer() {
      return Promise.resolve(20);
    },
    createOrder() {
      createdOrderCount += 1;
      return Promise.resolve(createOrderRecord(baseInput));
    },
  };

  const results = await Promise.allSettled([
    createOrderInTransaction(transaction, {
      ...baseInput,
      idempotencyKey: randomUUID(),
    }),
    createOrderInTransaction(transaction, {
      ...baseInput,
      idempotencyKey: randomUUID(),
    }),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(stock, 0);
  assert.equal(createdOrderCount, 1);

  const rejectedResult = rejected[0];
  const rejectedReason: unknown = rejectedResult?.reason;
  assert.ok(rejectedReason instanceof OrderServiceError);
  assert.equal(rejectedReason.code, "INSUFFICIENT_STOCK");
});

void test("bir xil tasdiqlash kaliti dublikat order yaratmaydi", async () => {
  let savedOrder: CreatedOrder | null = null;
  let transactionCount = 0;
  let stockReservationCount = 0;

  const repository: OrderRepository = {
    findByIdempotencyKey() {
      return Promise.resolve(savedOrder);
    },
    async runInTransaction(operation) {
      transactionCount += 1;
      const transaction: OrderTransaction = {
        findVariant() {
          return Promise.resolve({
            id: 10,
            size: "98",
            color: "Ko‘k",
            stock: 5,
            product: {
              id: 1,
              name: "Bolalar uchun sport kostyumi",
              price: 249_000,
              discountPrice: 199_000,
              isActive: true,
            },
          });
        },
        reserveStock() {
          stockReservationCount += 1;
          return Promise.resolve(true);
        },
        upsertCustomer() {
          return Promise.resolve(20);
        },
        createOrder() {
          savedOrder = createOrderRecord(baseInput);
          return Promise.resolve(savedOrder);
        },
      };

      return operation(transaction);
    },
  };
  const service = new OrderService(repository);

  const firstResult = await service.createOrder(baseInput);
  const secondResult = await service.createOrder(baseInput);

  assert.equal(firstResult.wasDuplicate, false);
  assert.equal(secondResult.wasDuplicate, true);
  assert.equal(firstResult.order.id, secondResult.order.id);
  assert.equal(transactionCount, 1);
  assert.equal(stockReservationCount, 1);
});

void test("1000 parallel checkout urinishida stock chegarasi buzilmaydi", async () => {
  let stock = 25;
  let createdOrderCount = 0;
  const transaction: OrderTransaction = {
    findVariant() {
      return Promise.resolve({
        id: 10,
        size: "98",
        color: "Ko‘k",
        stock,
        product: {
          id: 1,
          name: "Bolalar uchun sport kostyumi",
          price: 249_000,
          discountPrice: 199_000,
          isActive: true,
        },
      });
    },
    reserveStock(_productVariantId, quantity) {
      if (stock < quantity) {
        return Promise.resolve(false);
      }

      stock -= quantity;
      return Promise.resolve(true);
    },
    upsertCustomer() {
      return Promise.resolve(20);
    },
    createOrder() {
      createdOrderCount += 1;
      return Promise.resolve(createOrderRecord(baseInput));
    },
  };
  const results = await Promise.allSettled(
    Array.from({ length: 1_000 }, () =>
      createOrderInTransaction(transaction, {
        ...baseInput,
        idempotencyKey: randomUUID(),
      }),
    ),
  );

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    25,
  );
  assert.equal(createdOrderCount, 25);
  assert.equal(stock, 0);
});

void test("10 va 100 parallel checkout ham stock chegarasini buzmaydi", async () => {
  for (const attemptCount of [10, 100]) {
    let stock = 25;
    let createdOrderCount = 0;
    const transaction: OrderTransaction = {
      findVariant() {
        return Promise.resolve({
          id: 10,
          size: "98",
          color: "Ko'k",
          stock,
          product: {
            id: 1,
            name: "Bolalar uchun sport kostyumi",
            price: 249_000,
            discountPrice: 199_000,
            isActive: true,
          },
        });
      },
      reserveStock(_productVariantId, quantity) {
        if (stock < quantity) {
          return Promise.resolve(false);
        }

        stock -= quantity;
        return Promise.resolve(true);
      },
      upsertCustomer() {
        return Promise.resolve(20);
      },
      createOrder() {
        createdOrderCount += 1;
        return Promise.resolve(createOrderRecord(baseInput));
      },
    };
    const results = await Promise.allSettled(
      Array.from({ length: attemptCount }, () =>
        createOrderInTransaction(transaction, {
          ...baseInput,
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    const expectedOrders = Math.min(attemptCount, 25);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      expectedOrders,
    );
    assert.equal(createdOrderCount, expectedOrders);
    assert.equal(stock, 25 - expectedOrders);
  }
});
