import { z } from "zod";

const databaseIdSchema = z.number().int().positive();

export function createOwnedCartItemWhere(
  cartIdInput: unknown,
  cartItemIdInput: unknown,
): {
  cartId: number;
  id: number;
} {
  return {
    cartId: databaseIdSchema.parse(cartIdInput),
    id: databaseIdSchema.parse(cartItemIdInput),
  };
}

export function createOwnedOrderWhere(
  customerIdInput: unknown,
  orderIdInput: unknown,
): {
  customerId: number;
  id: number;
} {
  return {
    customerId: databaseIdSchema.parse(customerIdInput),
    id: databaseIdSchema.parse(orderIdInput),
  };
}
