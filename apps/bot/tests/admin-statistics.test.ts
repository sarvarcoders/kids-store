import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminStatisticsCallbackData,
  parseAdminStatisticsCallbackData,
} from "../src/config/admin-statistics.js";
import { isTelegramMessageNotModified } from "../src/handlers/admin-statistics.handler.js";
import { createAdminStatisticsKeyboard } from "../src/keyboards/admin-statistics.keyboard.js";
import { formatAdminStatistics } from "../src/services/admin-statistics.formatter.js";
import {
  AdminStatisticsService,
  getAdminStatisticsRange,
  type AdminStatisticsRange,
  type AdminStatisticsRepository,
  type AdminStatisticsSnapshot,
} from "../src/services/admin-statistics.service.js";

const now = new Date("2026-08-02T08:00:00.000Z");
const snapshot: AdminStatisticsSnapshot = {
  activeProducts: 5,
  channelPosts: 2,
  currentPendingOrders: 6,
  lowStockVariants: 7,
  newCustomers: 3,
  orders: 5,
  orderValue: 995_000,
  outOfStockVariants: 1,
  soldUnits: 8,
  statusCounts: [
    { count: 2, status: "PENDING" },
    { count: 1, status: "CONFIRMED" },
    { count: 1, status: "DELIVERED" },
    { count: 1, status: "CANCELLED" },
  ],
  topVariants: [
    {
      color: "Ko‘k",
      productName: "Sport kostyumi\nmaxfiy qator",
      quantity: 4,
      size: "104",
    },
  ],
};

class FakeStatisticsRepository implements AdminStatisticsRepository {
  range: AdminStatisticsRange | undefined;

  constructor(private readonly result: AdminStatisticsSnapshot) {}

  load(range: AdminStatisticsRange): Promise<AdminStatisticsSnapshot> {
    this.range = range;
    return Promise.resolve(this.result);
  }
}

void test("Toshkent vaqti bo‘yicha bugun, 7 va 30 kun chegaralarini hisoblaydi", () => {
  assert.deepEqual(getAdminStatisticsRange("today", now), {
    start: new Date("2026-08-01T19:00:00.000Z"),
    end: now,
  });
  assert.deepEqual(getAdminStatisticsRange("7d", now), {
    start: new Date("2026-07-26T19:00:00.000Z"),
    end: now,
  });
  assert.deepEqual(getAdminStatisticsRange("30d", now), {
    start: new Date("2026-07-03T19:00:00.000Z"),
    end: now,
  });
  assert.throws(() => getAdminStatisticsRange("all", now));
});

void test("statistika servisi repository natijasini validatsiya qiladi", async () => {
  const repository = new FakeStatisticsRepository(snapshot);
  const service = new AdminStatisticsService(repository);
  const report = await service.getStatistics("7d", now);

  assert.equal(report.period, "7d");
  assert.equal(report.orderValue, 995_000);
  assert.equal(report.generatedAt, now);
  assert.deepEqual(repository.range, {
    start: new Date("2026-07-26T19:00:00.000Z"),
    end: now,
  });

  const invalidRepository = new FakeStatisticsRepository({
    ...snapshot,
    orders: -1,
  });
  await assert.rejects(() =>
    new AdminStatisticsService(invalidRepository).getStatistics("today", now),
  );
});

void test("statistika xabari muhim qiymatlarni o‘zbek tilida chiqaradi", () => {
  const message = formatAdminStatistics({
    ...snapshot,
    generatedAt: now,
    period: "today",
    rangeStart: new Date("2026-08-01T19:00:00.000Z"),
  });

  assert.match(message, /Do‘kon statistikasi/);
  assert.match(message, /995[\s\u00A0]?000 so‘m/);
  assert.match(message, /Yangi mijozlar: 3 ta/);
  assert.match(message, /Kam qolgan variantlar \(1–5\): 7 ta/);
  assert.match(message, /Sport kostyumi maxfiy qator/);
  assert.doesNotMatch(message, /Sport kostyumi\nmaxfiy/);
});

void test("statistika callback va keyboard davrlarni qat’iy validatsiya qiladi", () => {
  assert.equal(createAdminStatisticsCallbackData("30d"), "admin_stats:30d");
  assert.equal(parseAdminStatisticsCallbackData("admin_stats:7d"), "7d");
  assert.throws(() => parseAdminStatisticsCallbackData("admin_stats:all"));

  const keyboard = createAdminStatisticsKeyboard("7d");
  assert.deepEqual(keyboard.inline_keyboard, [
    [
      { callback_data: "admin_stats:today", text: "Bugun" },
      { callback_data: "admin_stats:7d", text: "• 7 kun" },
      { callback_data: "admin_stats:30d", text: "30 kun" },
    ],
    [{ callback_data: "admin_stats:7d", text: "🔄 Yangilash" }],
  ]);
});

void test("bir xil Telegram xabari qayta edit qilinsa xavfsiz taniladi", () => {
  assert.equal(
    isTelegramMessageNotModified(
      new Error("Bad Request: message is not modified"),
    ),
    true,
  );
  assert.equal(
    isTelegramMessageNotModified(new Error("Telegram timeout")),
    false,
  );
});
