import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionOrderStatus,
  type OrderStatus,
} from "@kids-store/shared";

import {
  createAdminOrderCallbackData,
  parseAdminOrderCallbackData,
} from "../src/config/admin-order.js";
import {
  createAdminOrderKeyboard,
  createCustomerTelegramUrl,
} from "../src/keyboards/admin-order.keyboard.js";
import {
  formatAdminManagedOrder,
  formatCustomerOrderProgress,
} from "../src/services/admin-order.formatter.js";
import {
  AdminOrderService,
  AdminOrderServiceError,
  isRetryableAdminOrderTransactionError,
  runAdminOrderTransactionWithRetry,
  type AdminManagedOrder,
  type AdminOpenOrderList,
  type AdminOrderRepository,
} from "../src/services/admin-order.service.js";

const baseOrder: AdminManagedOrder = {
  id: 42,
  status: "PENDING",
  totalAmount: 398_000,
  deliveryAddress: "Toshkent\nChilonzor, 1-uy",
  createdAt: new Date("2026-08-02T08:00:00.000Z"),
  contactedAt: null,
  customer: {
    telegramUserId: 123_456n,
    username: "test_user",
    firstName: "O‘tkir 👋",
    phone: "+998901234567",
  },
  items: [
    {
      quantity: 2,
      unitPrice: 199_000,
      productVariant: {
        size: "104",
        color: "Ko‘k",
        product: { name: "Sport kostyumi" },
      },
    },
  ],
};

function cloneOrder(order: AdminManagedOrder): AdminManagedOrder {
  return structuredClone(order);
}

function hasCallbackData(button: unknown, callbackData: string): boolean {
  return (
    typeof button === "object" &&
    button !== null &&
    "callback_data" in button &&
    button.callback_data === callbackData
  );
}

class FakeAdminOrderRepository implements AdminOrderRepository {
  order = cloneOrder(baseOrder);
  contactWrites = 0;
  transitionWrites = 0;
  simulateTransitionRace = false;

  findById(orderId: number): Promise<AdminManagedOrder | null> {
    return Promise.resolve(orderId === this.order.id ? cloneOrder(this.order) : null);
  }

  listOpen(limit: number): Promise<AdminOpenOrderList> {
    const orders =
      ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(
        this.order.status,
      ) && limit > 0
        ? [cloneOrder(this.order)]
        : [];

    return Promise.resolve({ orders, total: orders.length });
  }

  markCustomerContacted(
    _adminTelegramId: string,
    orderId: number,
  ): Promise<{ wasDuplicate: boolean }> {
    if (orderId !== this.order.id) {
      throw new AdminOrderServiceError("ORDER_NOT_FOUND", "topilmadi");
    }

    if (this.order.contactedAt) {
      return Promise.resolve({ wasDuplicate: true });
    }

    this.contactWrites += 1;
    this.order = {
      ...this.order,
      contactedAt: new Date("2026-08-02T08:05:00.000Z"),
    };
    return Promise.resolve({ wasDuplicate: false });
  }

  transition(
    _adminTelegramId: string,
    orderId: number,
    nextStatus: OrderStatus,
  ): Promise<{
    customerTelegramUserId: bigint;
    wasDuplicate: boolean;
  }> {
    if (orderId !== this.order.id) {
      throw new AdminOrderServiceError("ORDER_NOT_FOUND", "topilmadi");
    }

    if (this.order.status === nextStatus) {
      return Promise.resolve({
        customerTelegramUserId: this.order.customer.telegramUserId,
        wasDuplicate: true,
      });
    }

    if (!canTransitionOrderStatus(this.order.status, nextStatus)) {
      throw new AdminOrderServiceError(
        "INVALID_TRANSITION",
        "noto‘g‘ri transition",
      );
    }

    this.transitionWrites += 1;
    this.order = { ...this.order, status: nextStatus };

    if (this.simulateTransitionRace) {
      throw new AdminOrderServiceError(
        "CONCURRENT_UPDATE",
        "parallel update",
      );
    }

    return Promise.resolve({
      customerTelegramUserId: this.order.customer.telegramUserId,
      wasDuplicate: false,
    });
  }
}

void test("admin order callbacklari qat’iy validatsiya qilinadi", () => {
  assert.equal(
    createAdminOrderCallbackData("payment", 42),
    "admin_order:payment:42",
  );
  assert.deepEqual(
    parseAdminOrderCallbackData("admin_order:shipped:42"),
    { action: "shipped", orderId: 42 },
  );
  assert.throws(() =>
    parseAdminOrderCallbackData("admin_order:unknown:42"),
  );
  assert.throws(() =>
    parseAdminOrderCallbackData("admin_order:payment:0"),
  );
});

void test("mijozga yozish URLi username yoki Telegram IDdan xavfsiz yaratiladi", () => {
  assert.equal(
    createCustomerTelegramUrl({
      telegramUserId: 123_456n,
      username: "test_user",
    }),
    "https://t.me/test_user",
  );
  assert.equal(
    createCustomerTelegramUrl({
      telegramUserId: 123_456n,
      username: null,
    }),
    "tg://user?id=123456",
  );
  assert.throws(() =>
    createCustomerTelegramUrl({
      telegramUserId: 123_456n,
      username: "bad username",
    }),
  );
});

void test("keyboard statusga mos keyingi amal va cancel tasdiqini ko‘rsatadi", () => {
  const pending = createAdminOrderKeyboard(baseOrder).inline_keyboard;

  assert.ok(
    pending.flat().some(
      (button) => hasCallbackData(button, "admin_order:payment:42"),
    ),
  );
  assert.ok(
    pending.flat().some(
      (button) =>
        hasCallbackData(button, "admin_order:cancel_request:42"),
    ),
  );

  const cancellation = createAdminOrderKeyboard(baseOrder, {
    confirmCancellation: true,
  }).inline_keyboard;
  assert.ok(
    cancellation.flat().some(
      (button) =>
        hasCallbackData(button, "admin_order:cancel_confirm:42"),
    ),
  );
  assert.equal(
    cancellation.flat().some(
      (button) => hasCallbackData(button, "admin_order:payment:42"),
    ),
    false,
  );
});

void test("admin va mijoz xabarlari plain text hamda aniq status beradi", () => {
  const adminMessage = formatAdminManagedOrder(baseOrder);
  const customerMessage = formatCustomerOrderProgress({
    orderId: 42,
    status: "PROCESSING",
  });

  assert.match(adminMessage, /Buyurtma #42/);
  assert.match(adminMessage, /Toshkent Chilonzor, 1-uy/);
  assert.match(adminMessage, /398[\s\u00A0]?000 so‘m/);
  assert.match(customerMessage, /Buyurtmangiz tayyor/);
  assert.match(customerMessage, /Buyurtma ID: 42/);
});

void test("ko‘p itemli admin xabari Telegram limitidan oshmaydi", () => {
  const message = formatAdminManagedOrder({
    ...baseOrder,
    items: Array.from({ length: 50 }, (_, index) => ({
      quantity: 1,
      unitPrice: 10_000,
      productVariant: {
        size: `size-${String(index)}`,
        color: "Uzun rang nomi",
        product: {
          name: `Juda uzun mahsulot nomi ${String(index)} `.repeat(5),
        },
      },
    })),
  });

  assert.ok(message.length <= 4_000);
  assert.match(message, /Jami: 398[\s\u00A0]?000 so‘m/);
});

void test("contact va status callbacklari qayta bosilganda dublikat yozmaydi", async () => {
  const repository = new FakeAdminOrderRepository();
  const service = new AdminOrderService(repository);

  const firstContact = await service.markCustomerContacted("123", 42);
  const secondContact = await service.markCustomerContacted("123", 42);
  const firstPayment = await service.transitionOrder(
    "123",
    42,
    "CONFIRMED",
  );
  const secondPayment = await service.transitionOrder(
    "123",
    42,
    "CONFIRMED",
  );

  assert.equal(firstContact.wasDuplicate, false);
  assert.equal(secondContact.wasDuplicate, true);
  assert.equal(repository.contactWrites, 1);
  assert.equal(firstPayment.wasDuplicate, false);
  assert.equal(secondPayment.wasDuplicate, true);
  assert.equal(repository.transitionWrites, 1);
});

void test("parallel status update yakunlangan bo‘lsa idempotent natija qaytaradi", async () => {
  const repository = new FakeAdminOrderRepository();
  repository.simulateTransitionRace = true;
  const service = new AdminOrderService(repository);
  const result = await service.transitionOrder("123", 42, "CONFIRMED");

  assert.equal(result.wasDuplicate, true);
  assert.equal(result.order.status, "CONFIRMED");
  assert.equal(repository.transitionWrites, 1);
});

void test("transaction pool vaqtincha band bo‘lsa bounded retry qiladi", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await runAdminOrderTransactionWithRetry(
    () => {
      attempts += 1;

      if (attempts < 3) {
        return Promise.reject(
          Object.assign(
            new Error(
              "Transaction API error: Unable to start a transaction in the given time.",
            ),
            { code: "P2028" },
          ),
        );
      }

      return Promise.resolve("ok");
    },
    (delayMs) => {
      delays.push(delayMs);
      return Promise.resolve();
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 750]);
});

void test("doimiy transaction xatosini retry qilmaydi", async () => {
  let attempts = 0;

  await assert.rejects(() =>
    runAdminOrderTransactionWithRetry(
      () => {
        attempts += 1;
        return Promise.reject(new Error("permission denied"));
      },
      () => Promise.resolve(),
    ),
  );

  assert.equal(attempts, 1);
  assert.equal(
    isRetryableAdminOrderTransactionError({ code: "P2034" }),
    true,
  );
  assert.equal(
    isRetryableAdminOrderTransactionError(new Error("permission denied")),
    false,
  );
});
