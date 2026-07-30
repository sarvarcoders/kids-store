import "server-only";

import {
  adminSessionSecretSchema,
  adminTelegramIdsSchema,
} from "@kids-store/shared";
import { z } from "zod";

const optionalUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.url().optional(),
);
const botTokenSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());

const adminServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TELEGRAM_BOT_TOKEN: botTokenSchema,
  TELEGRAM_CHANNEL_ID: z.string().trim().min(1).max(100),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/),
  ADMIN_TELEGRAM_IDS: adminTelegramIdsSchema,
  ADMIN_SESSION_SECRET: adminSessionSecretSchema,
  NEXT_PUBLIC_ADMIN_URL: optionalUrlSchema,
});

export type AdminServerEnv = z.infer<typeof adminServerEnvSchema>;

let cachedEnv: AdminServerEnv | undefined;

export function getAdminServerEnv(): AdminServerEnv {
  cachedEnv ??= adminServerEnvSchema.parse(process.env);
  return cachedEnv;
}

export function resetAdminServerEnvForTests(): void {
  if (process.env.NODE_ENV === "test") {
    cachedEnv = undefined;
  }
}
