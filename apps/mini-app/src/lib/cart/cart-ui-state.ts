import {
  cartDtoSchema,
  type CartDto,
} from "@kids-store/shared/cart";
import { z } from "zod";

const cartItemIdSchema = z.number().int().positive();
const quantitySchema = z.number().int().min(1).max(5);

function recalculateCart(cart: CartDto): CartDto {
  return cartDtoSchema.parse({
    ...cart,
    totalQuantity: cart.items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    totalAmount: cart.items.reduce(
      (total, item) =>
        item.isAvailable ? total + item.subtotal : total,
      0,
    ),
    unavailableItemsCount: cart.items.filter(
      (item) => !item.isAvailable,
    ).length,
  });
}

export function updateCartQuantityOptimistically(
  cartInput: unknown,
  cartItemIdInput: unknown,
  quantityInput: unknown,
): CartDto {
  const cart = cartDtoSchema.parse(cartInput);
  const cartItemId = cartItemIdSchema.parse(cartItemIdInput);
  const quantity = quantitySchema.parse(quantityInput);

  return recalculateCart({
    ...cart,
    items: cart.items.map((item) =>
      item.id === cartItemId
        ? {
            ...item,
            quantity,
            subtotal: item.unitPrice * quantity,
            isAvailable:
              item.isAvailable && quantity <= item.stock,
          }
        : item,
    ),
  });
}

export function removeCartItemOptimistically(
  cartInput: unknown,
  cartItemIdInput: unknown,
): CartDto {
  const cart = cartDtoSchema.parse(cartInput);
  const cartItemId = cartItemIdSchema.parse(cartItemIdInput);

  return recalculateCart({
    ...cart,
    items: cart.items.filter((item) => item.id !== cartItemId),
  });
}

export function clearCartOptimistically(
  cartInput: unknown,
): CartDto {
  const cart = cartDtoSchema.parse(cartInput);

  return recalculateCart({
    ...cart,
    items: [],
  });
}
