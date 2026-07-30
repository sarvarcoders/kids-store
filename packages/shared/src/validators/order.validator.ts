import { z } from "zod";

import { addressSchema } from "./address.validator.js";
import { customerSchema } from "./customer.validator.js";

export const orderQuantitySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(5);

export const orderIdempotencyKeySchema = z.uuid();

export const createOrderSchema = z.object({
  productVariantId: z.coerce.number().int().positive().max(2_147_483_647),
  quantity: orderQuantitySchema,
  deliveryAddress: addressSchema,
  idempotencyKey: orderIdempotencyKeySchema,
  customer: customerSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderQuantity = z.infer<typeof orderQuantitySchema>;
