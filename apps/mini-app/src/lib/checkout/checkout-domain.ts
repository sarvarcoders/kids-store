import { calculateEffectivePrice } from "@kids-store/shared";
import { z } from "zod";

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const checkoutItemSchema = z.object({
  quantity: z.number().int().min(1).max(5),
  productVariant: z.object({
    id: z.number().int().positive(),
    stock: z.number().int().nonnegative(),
    product: z.object({
      price: z.number().int().nonnegative(),
      discountPrice: z.number().int().nonnegative().nullable(),
      isActive: z.boolean(),
    }),
  }),
});
const checkoutItemsSchema = z.array(checkoutItemSchema);

export type CheckoutPlanErrorCode =
  | "EMPTY_CART"
  | "UNAVAILABLE_ITEM"
  | "INSUFFICIENT_STOCK"
  | "INVALID_TOTAL";

export class CheckoutPlanError extends Error {
  readonly code: CheckoutPlanErrorCode;

  constructor(code: CheckoutPlanErrorCode) {
    super(code);
    this.name = "CheckoutPlanError";
    this.code = code;
  }
}

export interface CheckoutPlan {
  orderItems: {
    productVariantId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  totalAmount: number;
}

export function buildCheckoutPlan(itemsInput: unknown): CheckoutPlan {
  const items = checkoutItemsSchema.parse(itemsInput);

  if (items.length === 0) {
    throw new CheckoutPlanError("EMPTY_CART");
  }

  const orderItems = items.map((item) => {
    const variant = item.productVariant;

    if (!variant.product.isActive || variant.stock <= 0) {
      throw new CheckoutPlanError("UNAVAILABLE_ITEM");
    }

    if (item.quantity > variant.stock) {
      throw new CheckoutPlanError("INSUFFICIENT_STOCK");
    }

    const unitPrice = calculateEffectivePrice(variant.product);
    const subtotal = unitPrice * item.quantity;

    if (
      !Number.isSafeInteger(subtotal) ||
      subtotal > POSTGRES_INTEGER_MAX
    ) {
      throw new CheckoutPlanError("INVALID_TOTAL");
    }

    return {
      productVariantId: variant.id,
      quantity: item.quantity,
      unitPrice,
      subtotal,
    };
  });
  const totalAmount = orderItems.reduce(
    (total, item) => total + item.subtotal,
    0,
  );

  if (
    !Number.isSafeInteger(totalAmount) ||
    totalAmount > POSTGRES_INTEGER_MAX
  ) {
    throw new CheckoutPlanError("INVALID_TOTAL");
  }

  return {
    orderItems,
    totalAmount,
  };
}
