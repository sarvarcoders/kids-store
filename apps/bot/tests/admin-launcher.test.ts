import assert from "node:assert/strict";
import test from "node:test";

import {
  adminAppUrlSchema,
  adminLauncherOptionsSchema,
  isAdminTelegramUser,
} from "../src/config/admin-launcher.js";
import {
  ADMIN_ACCESS_DENIED_MESSAGE,
  ADMIN_LAUNCHER_MESSAGE,
} from "../src/handlers/admin.handler.js";
import { createAdminLauncherKeyboard } from "../src/keyboards/admin-launcher.keyboard.js";

const ADMIN_APP_URL = "https://kids-store-admin-lyart.vercel.app";

void test("ADMIN_APP_URL faqat HTTPS URLni qabul qiladi", () => {
  assert.equal(adminAppUrlSchema.parse(ADMIN_APP_URL), ADMIN_APP_URL);
  assert.throws(() =>
    adminAppUrlSchema.parse("http://kids-store-admin.example.com"),
  );
  assert.throws(() => adminAppUrlSchema.parse("not-a-url"));
});

void test("admin launcher options allowlistni validatsiya qiladi", () => {
  assert.deepEqual(
    adminLauncherOptionsSchema.parse({
      adminAppUrl: ADMIN_APP_URL,
      allowedAdminIds: ["123", "456"],
    }),
    {
      adminAppUrl: ADMIN_APP_URL,
      allowedAdminIds: ["123", "456"],
    },
  );

  assert.throws(() =>
    adminLauncherOptionsSchema.parse({
      adminAppUrl: ADMIN_APP_URL,
      allowedAdminIds: [],
    }),
  );
});

void test("faqat ADMIN_TELEGRAM_IDS allowlistidagi user admin bo‘ladi", () => {
  assert.equal(isAdminTelegramUser(123, ["123", "456"]), true);
  assert.equal(isAdminTelegramUser(789, ["123", "456"]), false);
  assert.equal(isAdminTelegramUser(undefined, ["123", "456"]), false);
});

void test("admin keyboard Web App tugmasini to‘g‘ri yaratadi", () => {
  const keyboard = createAdminLauncherKeyboard(ADMIN_APP_URL);

  assert.deepEqual(keyboard.inline_keyboard, [
    [
      {
        text: "⚙️ Admin panel",
        web_app: {
          url: ADMIN_APP_URL,
        },
      },
    ],
    [
      {
        callback_data: "admin_stats:today",
        text: "📊 Statistika",
      },
    ],
    [
      {
        callback_data: "admin_orders:list",
        text: "📦 Zakazlar",
      },
    ],
  ]);
});

void test("admin handler xabarlari talabga mos", () => {
  assert.equal(ADMIN_ACCESS_DENIED_MESSAGE, "Bu bo‘lim siz uchun mavjud emas");
  assert.match(ADMIN_LAUNCHER_MESSAGE, /Admin panel/);
});
