import "server-only";

import {
  adminSessionSecretSchema,
  adminTelegramIdsSchema,
} from "@kids-store/shared";
import { z } from "zod";

import {
  PRODUCT_IMAGE_BUCKET_DEFAULT,
  parseProductImageBucket,
} from "../storage/product-image-policy";

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
const supabaseUrlSchema = z
  .url()
  .refine((value) => value.startsWith("https://"));
const serviceRoleKeySchema = z
  .string()
  .min(20)
  .refine((value) => value === value.trim());

const productImageStorageEnvSchema = z.object({
  SUPABASE_URL: supabaseUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKeySchema,
  SUPABASE_STORAGE_BUCKET: z
    .string()
    .default(PRODUCT_IMAGE_BUCKET_DEFAULT)
    .transform((value, context) => {
      try {
        return parseProductImageBucket(value);
      } catch {
        context.addIssue({
          code: "custom",
          message: "Supabase Storage bucket nomi noto‘g‘ri",
        });
        return z.NEVER;
      }
    }),
});

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
  CATALOG_REVALIDATION_URL: optionalUrlSchema,
  CACHE_REVALIDATION_SECRET: z.string().min(32).max(256).optional(),
}).superRefine((value, context) => {
  const hasUrl = value.CATALOG_REVALIDATION_URL !== undefined;
  const hasSecret = value.CACHE_REVALIDATION_SECRET !== undefined;

  if (hasUrl !== hasSecret) {
    context.addIssue({
      code: "custom",
      path: [hasUrl ? "CACHE_REVALIDATION_SECRET" : "CATALOG_REVALIDATION_URL"],
      message: "Catalog cache invalidation URL va secret birga berilishi kerak",
    });
  }
});

export type AdminServerEnv = z.infer<typeof adminServerEnvSchema>;
export type ProductImageStorageEnv = z.infer<
  typeof productImageStorageEnvSchema
>;

let cachedEnv: AdminServerEnv | undefined;
let cachedStorageEnv: ProductImageStorageEnv | undefined;

export function getAdminServerEnv(): AdminServerEnv {
  cachedEnv ??= adminServerEnvSchema.parse(process.env);
  return cachedEnv;
}

export function getProductImageStorageEnv(): ProductImageStorageEnv {
  cachedStorageEnv ??= productImageStorageEnvSchema.parse(process.env);
  return cachedStorageEnv;
}

export function resetAdminServerEnvForTests(): void {
  if (process.env.NODE_ENV === "test") {
    cachedEnv = undefined;
    cachedStorageEnv = undefined;
  }
}
