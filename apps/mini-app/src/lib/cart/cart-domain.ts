import {
  calculateEffectivePrice,
  cartDtoSchema,
  type CartDto,
} from "@kids-store/shared";
import { z } from "zod";

export interface CartRecord {
  id: number;
  customer: {
    phone: string | null;
  };
  items: {
    id: number;
    quantity: number;
    productVariant: {
      id: number;
      size: string;
      color: string;
      stock: number;
      product: {
        id: number;
        code: string;
        name: string;
        price: number;
        discountPrice: number | null;
        isActive: boolean;
        images: {
          url: string;
        }[];
      };
    };
  }[];
}

const quantityDecisionSchema = z.object({
  currentQuantity: z.number().int().min(0).max(5),
  requestedQuantity: z.number().int().min(1).max(5),
  stock: z.number().int().nonnegative(),
});

export type CartQuantityErrorCode =
  | "INSUFFICIENT_STOCK"
  | "QUANTITY_LIMIT";

export class CartQuantityError extends Error {
  readonly code: CartQuantityErrorCode;

  constructor(code: CartQuantityErrorCode) {
    super(code);
    this.name = "CartQuantityError";
    this.code = code;
  }
}

export function getNextCartQuantity(input: unknown): number {
  const values = quantityDecisionSchema.parse(input);
  const nextQuantity =
    values.currentQuantity + values.requestedQuantity;

  if (nextQuantity > values.stock) {
    throw new CartQuantityError("INSUFFICIENT_STOCK");
  }

  if (nextQuantity > 5) {
    throw new CartQuantityError("QUANTITY_LIMIT");
  }

  return nextQuantity;
}

export function formatCartDto(cart: CartRecord): CartDto {
  const items = cart.items.map((item) => {
    const variant = item.productVariant;
    const product = variant.product;
    const unitPrice = calculateEffectivePrice(product);
    const isAvailable =
      product.isActive &&
      variant.stock > 0 &&
      item.quantity <= variant.stock;

    return {
      id: item.id,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      productImage: product.images[0]?.url ?? null,
      variantId: variant.id,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice * item.quantity,
      isAvailable,
    };
  });

  return cartDtoSchema.parse({
    id: cart.id,
    items,
    totalQuantity: items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    totalAmount: items.reduce(
      (total, item) =>
        item.isAvailable ? total + item.subtotal : total,
      0,
    ),
    unavailableItemsCount: items.filter(
      (item) => !item.isAvailable,
    ).length,
    customerPhone: cart.customer.phone,
  });
}
