import { z } from "zod";

import { addressSchema } from "../validators/address.validator.js";
import {
  orderIdempotencyKeySchema,
  orderQuantitySchema,
} from "../validators/order.validator.js";
import { phoneSchema } from "../validators/phone.validator.js";

const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);
const moneySchema = z.number().int().nonnegative();
const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
const dateTimeSchema = z.iso.datetime();

export const addCartItemInputSchema = z.object({
  productVariantId: databaseIdSchema,
  quantity: orderQuantitySchema,
});

export const updateCartItemInputSchema = z.object({
  quantity: orderQuantitySchema,
});

export const cartItemDtoSchema = z.object({
  id: databaseIdSchema,
  productId: databaseIdSchema,
  productCode: z.string().trim().min(1).max(64),
  productName: z.string().trim().min(1).max(160),
  productImage: z.url().nullable(),
  variantId: databaseIdSchema,
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
  stock: z.number().int().nonnegative(),
  quantity: orderQuantitySchema,
  unitPrice: moneySchema,
  subtotal: moneySchema,
  isAvailable: z.boolean(),
});

export const cartDtoSchema = z.object({
  id: databaseIdSchema,
  items: z.array(cartItemDtoSchema),
  totalQuantity: z.number().int().nonnegative(),
  totalAmount: moneySchema,
  unavailableItemsCount: z.number().int().nonnegative(),
  customerPhone: phoneSchema.nullable(),
});

export const cartResponseSchema = z.object({
  data: cartDtoSchema,
});

export const checkoutInputSchema = z.object({
  phone: phoneSchema,
  deliveryAddress: addressSchema,
  idempotencyKey: orderIdempotencyKeySchema,
});

export const checkoutOrderItemDtoSchema = z.object({
  id: databaseIdSchema,
  productId: databaseIdSchema,
  productName: z.string().trim().min(1).max(160),
  variantId: databaseIdSchema,
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
  quantity: orderQuantitySchema,
  unitPrice: moneySchema,
  subtotal: moneySchema,
});

export const checkoutOrderDtoSchema = z.object({
  id: databaseIdSchema,
  status: orderStatusSchema,
  totalAmount: moneySchema,
  phone: phoneSchema,
  deliveryAddress: addressSchema,
  createdAt: dateTimeSchema,
  items: z.array(checkoutOrderItemDtoSchema).min(1),
});

export const checkoutResponseSchema = z.object({
  data: z.object({
    order: checkoutOrderDtoSchema,
    wasDuplicate: z.boolean(),
  }),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const orderListItemDtoSchema = z.object({
  id: databaseIdSchema,
  status: orderStatusSchema,
  totalAmount: moneySchema,
  createdAt: dateTimeSchema,
  productsCount: z.number().int().nonnegative(),
});

export const orderListResponseSchema = z.object({
  data: z.array(orderListItemDtoSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(20),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasPreviousPage: z.boolean(),
    hasNextPage: z.boolean(),
  }),
});

export const orderDetailDtoSchema = checkoutOrderDtoSchema;

export const orderDetailResponseSchema = z.object({
  data: orderDetailDtoSchema,
});

export type AddCartItemInput = z.infer<
  typeof addCartItemInputSchema
>;
export type CartDto = z.infer<typeof cartDtoSchema>;
export type CartItemDto = z.infer<typeof cartItemDtoSchema>;
export type CartResponse = z.infer<typeof cartResponseSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CheckoutOrderDto = z.infer<typeof checkoutOrderDtoSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type OrderDetailDto = z.infer<typeof orderDetailDtoSchema>;
export type OrderListItemDto = z.infer<typeof orderListItemDtoSchema>;
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type UpdateCartItemInput = z.infer<
  typeof updateCartItemInputSchema
>;
