import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { adminTelegramIdsSchema } from "@kids-store/shared";
import { z } from "zod";

import { adminAppUrlSchema } from "./admin-launcher.js";

config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .trim()
    .min(1, "TELEGRAM_BOT_TOKEN kiritilishi shart"),
  TELEGRAM_CHANNEL_ID: z
    .string()
    .trim()
    .regex(
      /^(?:-100[1-9]\d{5,}|@[A-Za-z][A-Za-z0-9_]{4,31})$/,
      "TELEGRAM_CHANNEL_ID -100... yoki @channel_username formatida bo‘lishi kerak",
    ),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .trim()
    .regex(
      /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/,
      "TELEGRAM_BOT_USERNAME noto‘g‘ri formatda",
    )
    .transform((value) => value.replace(/^@/, "")),
  ADMIN_TELEGRAM_ID: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, "ADMIN_TELEGRAM_ID musbat Telegram user ID bo‘lishi kerak")
    .transform((value) => BigInt(value)),
  ADMIN_TELEGRAM_IDS: adminTelegramIdsSchema,
  ADMIN_APP_URL: adminAppUrlSchema,
});

export const env = envSchema.parse(process.env);
