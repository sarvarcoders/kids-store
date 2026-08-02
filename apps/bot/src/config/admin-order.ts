import { z } from "zod";

import { databaseIdSchema } from "./validation.js";

export const ADMIN_ORDERS_LIST_CALLBACK = "admin_orders:list";

export const adminOrderActionSchema = z.enum([
  "refresh",
  "contacted",
  "payment",
  "ready",
  "shipped",
  "delivered",
  "notify",
  "cancel_request",
  "cancel_confirm",
]);

export type AdminOrderAction = z.infer<typeof adminOrderActionSchema>;

const adminOrderCallbackSchema = z
  .string()
  .trim()
  .max(64)
  .transform((value, context) => {
    const parts = value.split(":");

    if (parts.length !== 3 || parts[0] !== "admin_order") {
      context.addIssue({
        code: "custom",
        message: "Admin order callback formati noto‘g‘ri",
      });
      return z.NEVER;
    }

    const action = adminOrderActionSchema.safeParse(parts[1]);
    const orderId = databaseIdSchema.safeParse(parts[2]);

    if (!action.success || !orderId.success) {
      context.addIssue({
        code: "custom",
        message: "Admin order callback qiymati noto‘g‘ri",
      });
      return z.NEVER;
    }

    return {
      action: action.data,
      orderId: orderId.data,
    };
  });

export function createAdminOrderCallbackData(
  actionInput: unknown,
  orderIdInput: unknown,
): string {
  const action = adminOrderActionSchema.parse(actionInput);
  const orderId = databaseIdSchema.parse(orderIdInput);

  return `admin_order:${action}:${String(orderId)}`;
}

export function parseAdminOrderCallbackData(valueInput: unknown): {
  action: AdminOrderAction;
  orderId: number;
} {
  return adminOrderCallbackSchema.parse(valueInput);
}
