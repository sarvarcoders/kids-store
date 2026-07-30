import "server-only";

import { z } from "zod";

const optionalUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.url().optional(),
);
const botTokenSchema = z
  .string()
  .min(1, "TELEGRAM_BOT_TOKEN server uchun kiritilishi shart")
  .refine(
    (value) => value === value.trim(),
    "TELEGRAM_BOT_TOKEN boshida yoki oxirida whitespace bo‘lmasligi kerak",
  );

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    TELEGRAM_BOT_TOKEN: botTokenSchema.optional(),
    MINI_APP_DEV_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NEXT_PUBLIC_MINI_APP_URL: optionalUrlSchema,
  })
  .superRefine((value, context) => {
    const developmentMockEnabled =
      value.NODE_ENV === "development" && value.MINI_APP_DEV_MODE;

    if (
      !developmentMockEnabled &&
      (!value.TELEGRAM_BOT_TOKEN ||
        value.TELEGRAM_BOT_TOKEN.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN server uchun kiritilishi shart",
      });
    }
  });

export const serverEnv = serverEnvSchema.parse(process.env);

export function isMiniAppDevelopmentMockEnabled(): boolean {
  return (
    serverEnv.NODE_ENV === "development" &&
    serverEnv.MINI_APP_DEV_MODE
  );
}
