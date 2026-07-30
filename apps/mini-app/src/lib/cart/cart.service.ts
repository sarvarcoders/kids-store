import "server-only";

import {
  prisma,
  type Prisma,
} from "@kids-store/database";
import {
  addCartItemInputSchema,
  updateCartItemInputSchema,
  verifiedTelegramUserDtoSchema,
  type AddCartItemInput,
  type CartDto,
  type UpdateCartItemInput,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";
import { z } from "zod";

import {
  CartQuantityError,
  formatCartDto,
  getNextCartQuantity,
} from "./cart-domain";
import { createOwnedCartItemWhere } from "../auth/ownership";

const CART_MUTATION_INTERVAL_MS = 300;
const MAX_TRANSACTION_RETRIES = 3;
const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);

export type CartServiceErrorCode =
  | "CART_ITEM_NOT_FOUND"
  | "PRODUCT_NOT_AVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "QUANTITY_LIMIT"
  | "RATE_LIMITED";

const cartErrorMessages: Record<CartServiceErrorCode, string> = {
  CART_ITEM_NOT_FOUND: "Savatcha mahsuloti topilmadi.",
  PRODUCT_NOT_AVAILABLE: "Mahsulot yoki variant hozir sotuvda mavjud emas.",
  INSUFFICIENT_STOCK: "Tanlangan miqdor uchun omborda mahsulot yetarli emas.",
  QUANTITY_LIMIT: "Bitta variantdan ko‘pi bilan 5 dona olish mumkin.",
  RATE_LIMITED: "Juda tez so‘rov yuborildi. Bir oz kutib qayta urinib ko‘ring.",
};

export class CartServiceError extends Error {
  readonly code: CartServiceErrorCode;

  constructor(code: CartServiceErrorCode, cause?: unknown) {
    super(
      cartErrorMessages[code],
      cause === undefined ? undefined : { cause },
    );
    this.name = "CartServiceError";
    this.code = code;
  }
}

const cartSelect = {
  id: true,
  customer: {
    select: {
      phone: true,
    },
  },
  items: {
    select: {
      id: true,
      quantity: true,
      productVariant: {
        select: {
          id: true,
          size: true,
          color: true,
          stock: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              price: true,
              discountPrice: true,
              isActive: true,
              images: {
                select: {
                  url: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

function normalizeTelegramUsername(
  username: string | undefined,
): string | undefined {
  const normalized = username?.trim();

  return normalized && normalized.length <= 32
    ? normalized
    : undefined;
}

export async function upsertTelegramCustomer(
  transaction: Prisma.TransactionClient,
  user: VerifiedTelegramUserDto,
  phone?: string,
): Promise<number> {
  const username = normalizeTelegramUsername(user.username);
  const usernameData =
    username === undefined ? {} : { username };
  const phoneData = phone === undefined ? {} : { phone };
  const customer = await transaction.customer.upsert({
    where: {
      telegramUserId: BigInt(user.id),
    },
    create: {
      telegramUserId: BigInt(user.id),
      firstName: user.firstName,
      ...usernameData,
      ...phoneData,
    },
    update: {
      firstName: user.firstName,
      ...usernameData,
      ...phoneData,
    },
    select: {
      id: true,
    },
  });

  return customer.id;
}

export async function acquireCartMutationPermit(
  transaction: Prisma.TransactionClient,
  customerId: number,
): Promise<number> {
  const now = new Date();
  const availableBefore = new Date(
    now.getTime() - CART_MUTATION_INTERVAL_MS,
  );
  const rows = await transaction.$queryRaw<{ id: number }[]>`
    INSERT INTO "Cart" ("customerId", "createdAt", "updatedAt")
    VALUES (${customerId}, ${now}, ${now})
    ON CONFLICT ("customerId") DO UPDATE
      SET "updatedAt" = EXCLUDED."updatedAt"
      WHERE "Cart"."updatedAt" <= ${availableBefore}
    RETURNING "id"
  `;
  const cart = rows[0];

  if (!cart) {
    throw new CartServiceError("RATE_LIMITED");
  }

  return cart.id;
}

async function ensureCart(
  transaction: Prisma.TransactionClient,
  customerId: number,
): Promise<number> {
  const cart = await transaction.cart.upsert({
    where: {
      customerId,
    },
    create: {
      customerId,
    },
    update: {},
    select: {
      id: true,
    },
  });

  return cart.id;
}

async function loadCartById(cartId: number): Promise<CartDto> {
  const cart = await prisma.cart.findUnique({
    where: {
      id: cartId,
    },
    select: cartSelect,
  });

  if (!cart) {
    throw new Error("Savatcha transactiondan keyin topilmadi.");
  }

  return formatCartDto(cart);
}

function hasPrismaErrorCode(
  error: unknown,
  codes: readonly string[],
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.includes(error.code)
  );
}

export async function runSerializableCartTransaction<T>(
  operation: (
    transaction: Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_RETRIES;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      lastError = error;

      if (
        !hasPrismaErrorCode(error, ["P2002", "P2034"]) ||
        attempt === MAX_TRANSACTION_RETRIES
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function getCartForTelegramUser(
  userInput: unknown,
): Promise<CartDto> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);
  const cartId = await prisma.$transaction(async (transaction) => {
    const customerId = await upsertTelegramCustomer(transaction, user);
    return ensureCart(transaction, customerId);
  });

  return loadCartById(cartId);
}

export async function addCartItem(
  userInput: unknown,
  input: unknown,
): Promise<CartDto> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);
  const validatedInput: AddCartItemInput =
    addCartItemInputSchema.parse(input);
  const cartId = await runSerializableCartTransaction(
    async (transaction) => {
      const customerId = await upsertTelegramCustomer(
        transaction,
        user,
      );
      const currentCartId = await acquireCartMutationPermit(
        transaction,
        customerId,
      );
      const variant =
        await transaction.productVariant.findUnique({
          where: {
            id: validatedInput.productVariantId,
          },
          select: {
            id: true,
            stock: true,
            product: {
              select: {
                isActive: true,
              },
            },
          },
        });

      if (!variant?.product.isActive || variant.stock <= 0) {
        throw new CartServiceError("PRODUCT_NOT_AVAILABLE");
      }

      if (validatedInput.quantity > variant.stock) {
        throw new CartServiceError("INSUFFICIENT_STOCK");
      }

      const maximumQuantity = Math.min(5, variant.stock);
      const updated = await transaction.cartItem.updateMany({
        where: {
          cartId: currentCartId,
          productVariantId: variant.id,
          quantity: {
            lte: maximumQuantity - validatedInput.quantity,
          },
        },
        data: {
          quantity: {
            increment: validatedInput.quantity,
          },
        },
      });

      if (updated.count === 0) {
        const existingItem =
          await transaction.cartItem.findUnique({
            where: {
              cartId_productVariantId: {
                cartId: currentCartId,
                productVariantId: variant.id,
              },
            },
            select: {
              quantity: true,
            },
          });

        if (existingItem) {
          try {
            getNextCartQuantity({
              currentQuantity: existingItem.quantity,
              requestedQuantity: validatedInput.quantity,
              stock: variant.stock,
            });
          } catch (error) {
            if (error instanceof CartQuantityError) {
              throw new CartServiceError(error.code, error);
            }

            throw error;
          }

          throw new CartServiceError("QUANTITY_LIMIT");
        }

        await transaction.cartItem.create({
          data: {
            cartId: currentCartId,
            productVariantId: variant.id,
            quantity: validatedInput.quantity,
          },
        });
      }

      return currentCartId;
    },
  );

  return loadCartById(cartId);
}

export async function updateCartItemQuantity(
  userInput: unknown,
  cartItemIdInput: unknown,
  input: unknown,
): Promise<CartDto> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);
  const cartItemId = databaseIdSchema.parse(cartItemIdInput);
  const validatedInput: UpdateCartItemInput =
    updateCartItemInputSchema.parse(input);
  const cartId = await runSerializableCartTransaction(
    async (transaction) => {
      const customerId = await upsertTelegramCustomer(
        transaction,
        user,
      );
      const currentCartId = await acquireCartMutationPermit(
        transaction,
        customerId,
      );
      const item = await transaction.cartItem.findFirst({
        where: createOwnedCartItemWhere(
          currentCartId,
          cartItemId,
        ),
        select: {
          id: true,
          productVariant: {
            select: {
              stock: true,
              product: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!item) {
        throw new CartServiceError("CART_ITEM_NOT_FOUND");
      }

      if (
        !item.productVariant.product.isActive ||
        item.productVariant.stock <= 0
      ) {
        throw new CartServiceError("PRODUCT_NOT_AVAILABLE");
      }

      if (validatedInput.quantity > item.productVariant.stock) {
        throw new CartServiceError("INSUFFICIENT_STOCK");
      }

      await transaction.cartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: validatedInput.quantity,
        },
      });

      return currentCartId;
    },
  );

  return loadCartById(cartId);
}

export async function removeCartItem(
  userInput: unknown,
  cartItemIdInput: unknown,
): Promise<CartDto> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);
  const cartItemId = databaseIdSchema.parse(cartItemIdInput);
  const cartId = await runSerializableCartTransaction(
    async (transaction) => {
      const customerId = await upsertTelegramCustomer(
        transaction,
        user,
      );
      const currentCartId = await acquireCartMutationPermit(
        transaction,
        customerId,
      );
      const deleted = await transaction.cartItem.deleteMany({
        where: createOwnedCartItemWhere(
          currentCartId,
          cartItemId,
        ),
      });

      if (deleted.count === 0) {
        throw new CartServiceError("CART_ITEM_NOT_FOUND");
      }

      return currentCartId;
    },
  );

  return loadCartById(cartId);
}

export async function clearCart(
  userInput: unknown,
): Promise<CartDto> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);
  const cartId = await runSerializableCartTransaction(
    async (transaction) => {
      const customerId = await upsertTelegramCustomer(
        transaction,
        user,
      );
      const currentCartId = await acquireCartMutationPermit(
        transaction,
        customerId,
      );

      await transaction.cartItem.deleteMany({
        where: {
          cartId: currentCartId,
        },
      });

      return currentCartId;
    },
  );

  return loadCartById(cartId);
}
