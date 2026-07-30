import "server-only";

import { prisma } from "@kids-store/database";
import {
  checkoutInputSchema,
  checkoutOrderDtoSchema,
  verifiedTelegramUserDtoSchema,
  type CheckoutInput,
  type CheckoutOrderDto,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";

import {
  acquireCartMutationPermit,
  runSerializableCartTransaction,
  upsertTelegramCustomer,
} from "../cart/cart.service";
import {
  buildCheckoutPlan,
  CheckoutPlanError,
} from "./checkout-domain";


export type CheckoutServiceErrorCode =
  | "EMPTY_CART"
  | "UNAVAILABLE_ITEM"
  | "INSUFFICIENT_STOCK"
  | "INVALID_TOTAL"
  | "IDEMPOTENCY_CONFLICT";

const checkoutErrorMessages: Record<
  CheckoutServiceErrorCode,
  string
> = {
  EMPTY_CART: "Savatcha bo‘sh. Avval mahsulot qo‘shing.",
  UNAVAILABLE_ITEM:
    "Savatchadagi ayrim mahsulotlar hozir sotuvda mavjud emas.",
  INSUFFICIENT_STOCK:
    "Savatchadagi ayrim mahsulotlar uchun omborda yetarli qoldiq yo‘q.",
  INVALID_TOTAL: "Buyurtma summasini hisoblab bo‘lmadi.",
  IDEMPOTENCY_CONFLICT:
    "Bu tasdiqlash kaliti boshqa buyurtma uchun ishlatilgan.",
};

export class CheckoutServiceError extends Error {
  readonly code: CheckoutServiceErrorCode;

  constructor(code: CheckoutServiceErrorCode, cause?: unknown) {
    super(
      checkoutErrorMessages[code],
      cause === undefined ? undefined : { cause },
    );
    this.name = "CheckoutServiceError";
    this.code = code;
  }
}

interface PersistedCheckoutOrder {
  id: number;
  status: string;
  totalAmount: number;
  deliveryAddress: string | null;
  createdAt: Date;
  customer: {
    telegramUserId: bigint;
    phone: string | null;
  };
  items: {
    id: number;
    quantity: number;
    unitPrice: number;
    productVariantId: number;
    productVariant: {
      size: string;
      color: string;
      product: {
        id: number;
        name: string;
      };
    };
  }[];
}

const checkoutOrderSelect = {
  id: true,
  status: true,
  totalAmount: true,
  deliveryAddress: true,
  createdAt: true,
  customer: {
    select: {
      telegramUserId: true,
      phone: true,
    },
  },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productVariantId: true,
      productVariant: {
        select: {
          size: true,
          color: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} as const;

export interface CheckoutResult {
  order: CheckoutOrderDto;
  wasDuplicate: boolean;
}

function formatCheckoutOrder(
  order: PersistedCheckoutOrder,
): CheckoutOrderDto {
  if (
    order.deliveryAddress === null ||
    order.customer.phone === null
  ) {
    throw new CheckoutServiceError("INVALID_TOTAL");
  }

  return checkoutOrderDtoSchema.parse({
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    phone: order.customer.phone,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productVariant.product.id,
      productName: item.productVariant.product.name,
      variantId: item.productVariantId,
      size: item.productVariant.size,
      color: item.productVariant.color,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
    })),
  });
}

function assertOrderOwnership(
  order: PersistedCheckoutOrder,
  telegramUserId: bigint,
): void {
  if (order.customer.telegramUserId !== telegramUserId) {
    throw new CheckoutServiceError("IDEMPOTENCY_CONFLICT");
  }
}

async function findExistingOrder(
  idempotencyKey: string,
): Promise<PersistedCheckoutOrder | null> {
  return prisma.order.findUnique({
    where: {
      idempotencyKey,
    },
    select: checkoutOrderSelect,
  });
}

export async function checkoutCart(
  userInput: unknown,
  input: unknown,
): Promise<CheckoutResult> {
  const user: VerifiedTelegramUserDto =
    verifiedTelegramUserDtoSchema.parse(userInput);
  const validatedInput: CheckoutInput =
    checkoutInputSchema.parse(input);
  const telegramUserId = BigInt(user.id);
  const existingOrder = await findExistingOrder(
    validatedInput.idempotencyKey,
  );

  if (existingOrder) {
    assertOrderOwnership(existingOrder, telegramUserId);
    return {
      order: formatCheckoutOrder(existingOrder),
      wasDuplicate: true,
    };
  }

  return runSerializableCartTransaction(
    async (transaction) => {
      const concurrentOrder = await transaction.order.findUnique({
        where: {
          idempotencyKey: validatedInput.idempotencyKey,
        },
        select: checkoutOrderSelect,
      });

      if (concurrentOrder) {
        assertOrderOwnership(concurrentOrder, telegramUserId);
        return {
          order: formatCheckoutOrder(concurrentOrder),
          wasDuplicate: true,
        };
      }

      const customerId = await upsertTelegramCustomer(
        transaction,
        user,
        validatedInput.phone,
      );
      const cartId = await acquireCartMutationPermit(
        transaction,
        customerId,
      );
      const cart = await transaction.cart.findUnique({
        where: {
          id: cartId,
        },
        select: {
          items: {
            select: {
              quantity: true,
              productVariant: {
                select: {
                  id: true,
                  stock: true,
                  size: true,
                  color: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      discountPrice: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let checkoutPlan: ReturnType<typeof buildCheckoutPlan>;

      try {
        checkoutPlan = buildCheckoutPlan(cart?.items ?? []);
      } catch (error) {
        if (error instanceof CheckoutPlanError) {
          throw new CheckoutServiceError(error.code, error);
        }

        throw error;
      }
      const { orderItems, totalAmount } = checkoutPlan;

      for (const item of orderItems) {
        const reserved =
          await transaction.productVariant.updateMany({
            where: {
              id: item.productVariantId,
              stock: {
                gte: item.quantity,
              },
              product: {
                isActive: true,
              },
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

        if (reserved.count !== 1) {
          throw new CheckoutServiceError(
            "INSUFFICIENT_STOCK",
          );
        }
      }

      const order = await transaction.order.create({
        data: {
          status: "PENDING",
          totalAmount,
          deliveryAddress: validatedInput.deliveryAddress,
          idempotencyKey: validatedInput.idempotencyKey,
          customerId,
          items: {
            create: orderItems.map((item) => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        select: checkoutOrderSelect,
      });

      await transaction.cartItem.deleteMany({
        where: {
          cartId,
        },
      });

      return {
        order: formatCheckoutOrder(order),
        wasDuplicate: false,
      };
    },
  );
}
