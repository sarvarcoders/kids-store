import { z } from "zod";

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(POSTGRES_INTEGER_MAX);
const optionalTrimmedString = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? null
        : value,
    z.string().trim().max(maximum).nullable(),
  );
const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const adminTelegramIdsSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.split(",").map((part) => part.trim()))
  .pipe(z.array(z.string().regex(/^[1-9]\d*$/)).min(1))
  .transform((values) => Array.from(new Set(values)));

export const adminSessionSecretSchema = z
  .string()
  .min(32)
  .max(256)
  .refine((value) => value === value.trim());

export const adminLoginInputSchema = z.object({
  initData: z.string().min(1).max(16_384),
});

export const adminProductImageInputSchema = z.object({
  id: databaseIdSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(7),
  url: z
    .url()
    .max(2_048)
    .refine(
      (value) => value.startsWith("https://"),
      "Rasm URL HTTPS bo‘lishi kerak",
    ),
});

export const adminProductVariantInputSchema = z.object({
  id: databaseIdSchema.optional(),
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
  stock: z.coerce
    .number()
    .int()
    .min(0)
    .max(POSTGRES_INTEGER_MAX),
});

export const adminProductInputSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: optionalTrimmedString(5_000),
    categoryId: databaseIdSchema,
    price: z.coerce
      .number()
      .int()
      .min(0)
      .max(POSTGRES_INTEGER_MAX),
    discountPrice: z.preprocess(
      (value) =>
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0)
          ? null
          : value,
      z.coerce
        .number()
        .int()
        .min(0)
        .max(POSTGRES_INTEGER_MAX)
        .nullable(),
    ),
    isActive: z.boolean(),
    images: z
      .array(adminProductImageInputSchema)
      .min(1, "Kamida bitta rasm yuklang")
      .max(8),
    variants: z.array(adminProductVariantInputSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const variantKeys = new Set<string>();
    const imageOrders = new Set<number>();

    value.variants.forEach((variant, index) => {
      const key = `${variant.size.toLocaleLowerCase("uz")}::${variant.color.toLocaleLowerCase("uz")}`;

      if (variantKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["variants", index],
          message: "Bir xil o‘lcham va rang takrorlanmasligi kerak",
        });
      }

      variantKeys.add(key);
    });

    value.images.forEach((image, index) => {
      if (imageOrders.has(image.sortOrder)) {
        context.addIssue({
          code: "custom",
          path: ["images", index, "sortOrder"],
          message: "Rasm tartib raqami takrorlanmasligi kerak",
        });
      }

      imageOrders.add(image.sortOrder);
    });
  });

export const adminCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminProductQuerySchema = adminPaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  categoryId: databaseIdSchema.optional(),
  active: booleanQuerySchema.optional(),
  discount: booleanQuerySchema.optional(),
  lowStock: booleanQuerySchema.optional(),
  sort: z
    .enum(["newest", "oldest", "name", "price_asc", "price_desc"])
    .default("newest"),
});

export const adminOrderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const adminOrderStatusInputSchema = z.object({
  status: adminOrderStatusSchema,
});

export const adminOrderQuerySchema = adminPaginationQuerySchema
  .extend({
    status: adminOrderStatusSchema.optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    customer: z.string().trim().max(100).optional(),
    orderId: databaseIdSchema.optional(),
    minAmount: z.coerce.number().int().min(0).optional(),
    maxAmount: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.minAmount !== undefined &&
      value.maxAmount !== undefined &&
      value.minAmount > value.maxAmount
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxAmount"],
        message: "Maksimal summa minimal summadan kam bo‘lmasligi kerak",
      });
    }
  });

export const adminAuditQuerySchema = adminPaginationQuerySchema.extend({
  adminTelegramId: z.string().regex(/^[1-9]\d*$/).optional(),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
});

export const adminChannelPostQuerySchema =
  adminPaginationQuerySchema.extend({
    productId: databaseIdSchema.optional(),
    channelId: z.string().trim().max(100).optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
  });

export const adminCustomerQuerySchema = adminPaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const adminIdempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type AdminCategoryInput = z.infer<
  typeof adminCategoryInputSchema
>;
export type AdminChannelPostQuery = z.infer<
  typeof adminChannelPostQuerySchema
>;
export type AdminCustomerQuery = z.infer<
  typeof adminCustomerQuerySchema
>;
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export type AdminOrderStatus = z.infer<typeof adminOrderStatusSchema>;
export type AdminProductInput = z.infer<typeof adminProductInputSchema>;
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;
