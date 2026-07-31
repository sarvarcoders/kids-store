import type { CartDto } from "@kids-store/shared/cart";

function validateCartMutation(
  cartItemId: number,
  quantity?: number,
): void {
  if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
    throw new Error("Savatcha elementi ID qiymati noto‘g‘ri.");
  }

  if (
    quantity !== undefined &&
    (!Number.isInteger(quantity) || quantity < 1 || quantity > 5)
  ) {
    throw new Error("Mahsulot miqdori 1 dan 5 gacha bo‘lishi kerak.");
  }
}

function recalculateCart(cart: CartDto): CartDto {
  return {
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
  };
}

export function updateCartQuantityOptimistically(
  cart: CartDto,
  cartItemId: number,
  quantity: number,
): CartDto {
  validateCartMutation(cartItemId, quantity);

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
  cart: CartDto,
  cartItemId: number,
): CartDto {
  validateCartMutation(cartItemId);

  return recalculateCart({
    ...cart,
    items: cart.items.filter((item) => item.id !== cartItemId),
  });
}

export function clearCartOptimistically(
  cart: CartDto,
): CartDto {
  return recalculateCart({
    ...cart,
    items: [],
  });
}
