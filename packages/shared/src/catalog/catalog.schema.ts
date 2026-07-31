import { z } from "zod";

import { verifiedTelegramUserDtoSchema } from "../telegram/telegram-web-app.schema.js";

const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);
const moneySchema = z.number().int().nonnegative();
const httpsUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => value.startsWith("https://"), {
    message: "Rasm URL HTTPS bo‘lishi kerak",
  });

const optionalSearchSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z
    .string()
    .trim()
    .min(2, "Qidiruv kamida 2 ta belgidan iborat bo‘lishi kerak")
    .max(80, "Qidiruv 80 ta belgidan oshmasligi kerak")
    .optional(),
);

const optionalCategorySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Kategoriya slug noto‘g‘ri")
    .optional(),
);

const discountOnlySchema = z.preprocess(
  (value) => (value === undefined || value === "" ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true"),
);

export const productIdSchema = databaseIdSchema;

export const productQuerySchema = z.object({
  category: optionalCategorySchema,
  search: optionalSearchSchema,
  discountOnly: discountOnlySchema,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export const categoryDtoSchema = z.object({
  id: databaseIdSchema,
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(160),
});

export const productImageDtoSchema = z.object({
  id: databaseIdSchema,
  url: httpsUrlSchema,
  sortOrder: z.number().int().nonnegative(),
});

export const productVariantDtoSchema = z.object({
  id: databaseIdSchema,
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
  stock: z.number().int().positive(),
});

export const productListItemDtoSchema = z.object({
  id: databaseIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  price: moneySchema,
  discountPrice: moneySchema.nullable(),
  category: categoryDtoSchema,
  primaryImage: productImageDtoSchema.nullable(),
  availableSizes: z.array(z.string().trim().min(1).max(50)).max(50),
});

export const catalogProductDtoSchema = z.object({
  id: databaseIdSchema,
  name: z.string().trim().min(1).max(160),
  price: moneySchema,
  discountPrice: moneySchema.optional(),
  categoryName: z.string().trim().min(1).max(120),
  imageUrl: httpsUrlSchema.optional(),
  availableSizes: z.array(z.string().trim().min(1).max(50)).max(12),
});

export const productDetailDtoSchema = productListItemDtoSchema
  .omit({
    primaryImage: true,
    availableSizes: true,
  })
  .extend({
    description: z.string().trim().nullable(),
    images: z.array(productImageDtoSchema),
    variants: z.array(productVariantDtoSchema).min(1),
  });

export const paginationDtoSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(24),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
});

export const categoryListResponseSchema = z.object({
  data: z.array(categoryDtoSchema).max(100),
});

export const productListResponseSchema = z.object({
  data: z.array(productListItemDtoSchema),
  pagination: paginationDtoSchema,
});

export const productDetailResponseSchema = z.object({
  data: productDetailDtoSchema,
});

export const catalogResponseSchema = z.object({
  categories: z.array(categoryDtoSchema).max(100),
  products: z.array(catalogProductDtoSchema).max(24),
  discountProducts: z.array(catalogProductDtoSchema).max(12),
  user: verifiedTelegramUserDtoSchema,
  pagination: paginationDtoSchema,
  cartQuantity: z.number().int().nonnegative(),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().trim().min(1).max(64),
    message: z.string().trim().min(1).max(300),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type CategoryDto = z.infer<typeof categoryDtoSchema>;
export type CategoryListResponse = z.infer<
  typeof categoryListResponseSchema
>;
export type CatalogProductDto = z.infer<typeof catalogProductDtoSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type PaginationDto = z.infer<typeof paginationDtoSchema>;
export type ProductDetailDto = z.infer<typeof productDetailDtoSchema>;
export type ProductDetailResponse = z.infer<
  typeof productDetailResponseSchema
>;
export type ProductImageDto = z.infer<typeof productImageDtoSchema>;
export type ProductListItemDto = z.infer<typeof productListItemDtoSchema>;
export type ProductListResponse = z.infer<typeof productListResponseSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductVariantDto = z.infer<typeof productVariantDtoSchema>;
