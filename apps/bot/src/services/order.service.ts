import {
  calculateEffectivePrice,
  createOrderSchema,
  type CreateOrderInput,
} from "@kids-store/shared";

import type {
  CreatedOrder,
  OrderRepository,
  OrderTransaction,
  OrderVariantRecord,
} from "./order.repository.js";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export type OrderServiceErrorCode =
  | "PRODUCT_NOT_AVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "INVALID_PRICE";

const errorMessages: Record<OrderServiceErrorCode, string> = {
  PRODUCT_NOT_AVAILABLE: "Mahsulot yoki variant sotuvda mavjud emas.",
  INSUFFICIENT_STOCK: "Tanlangan miqdor uchun omborda mahsulot yetarli emas.",
  INVALID_PRICE: "Mahsulot narxi bilan buyurtma yaratib bo‘lmaydi.",
};

export class OrderServiceError extends Error {
  readonly code: OrderServiceErrorCode;
  readonly availableStock: number | null;

  constructor(
    code: OrderServiceErrorCode,
    options: { availableStock?: number; cause?: unknown } = {},
  ) {
    super(
      errorMessages[code],
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "OrderServiceError";
    this.code = code;
    this.availableStock = options.availableStock ?? null;
  }
}

export interface OrderCreationResult {
  order: CreatedOrder;
  wasDuplicate: boolean;
}

export function calculateUnitPrice(
  product: Pick<OrderVariantRecord["product"], "price" | "discountPrice">,
): number {
  return calculateEffectivePrice(product);
}

export async function createOrderInTransaction(
  transaction: OrderTransaction,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  const variant = await transaction.findVariant(input.productVariantId);

  if (!variant?.product.isActive) {
    throw new OrderServiceError("PRODUCT_NOT_AVAILABLE");
  }

  if (variant.stock < input.quantity) {
    throw new OrderServiceError("INSUFFICIENT_STOCK", {
      availableStock: variant.stock,
    });
  }

  const unitPrice = calculateUnitPrice(variant.product);
  const totalAmount = unitPrice * input.quantity;

  if (
    !Number.isSafeInteger(unitPrice) ||
    unitPrice < 0 ||
    !Number.isSafeInteger(totalAmount) ||
    totalAmount > POSTGRES_INTEGER_MAX
  ) {
    throw new OrderServiceError("INVALID_PRICE");
  }

  const stockReserved = await transaction.reserveStock(
    variant.id,
    input.quantity,
  );

  if (!stockReserved) {
    throw new OrderServiceError("INSUFFICIENT_STOCK");
  }

  const customerId = await transaction.upsertCustomer(input.customer);

  return transaction.createOrder({
    customerId,
    productVariantId: variant.id,
    quantity: input.quantity,
    unitPrice,
    totalAmount,
    deliveryAddress: input.deliveryAddress,
    idempotencyKey: input.idempotencyKey,
  });
}

export class OrderService {
  private repository: OrderRepository | null;

  constructor(repository?: OrderRepository) {
    this.repository = repository ?? null;
  }

  async createOrder(input: unknown): Promise<OrderCreationResult> {
    const validatedInput = createOrderSchema.parse(input);
    const repository = await this.getRepository();
    const existingOrder = await repository.findByIdempotencyKey(
      validatedInput.idempotencyKey,
    );

    if (existingOrder) {
      return {
        order: existingOrder,
        wasDuplicate: true,
      };
    }

    try {
      const order = await repository.runInTransaction((transaction) =>
        createOrderInTransaction(transaction, validatedInput),
      );

      return {
        order,
        wasDuplicate: false,
      };
    } catch (error) {
      const concurrentlyCreatedOrder =
        await this.findConcurrentDuplicateSafely(
          repository,
          validatedInput.idempotencyKey,
        );

      if (concurrentlyCreatedOrder) {
        return {
          order: concurrentlyCreatedOrder,
          wasDuplicate: true,
        };
      }

      throw error;
    }
  }

  private async getRepository(): Promise<OrderRepository> {
    if (this.repository) {
      return this.repository;
    }

    const { PrismaOrderRepository } = await import("./order.repository.js");
    this.repository = new PrismaOrderRepository();

    return this.repository;
  }

  private async findConcurrentDuplicateSafely(
    repository: OrderRepository,
    idempotencyKey: string,
  ): Promise<CreatedOrder | null> {
    try {
      return await repository.findByIdempotencyKey(idempotencyKey);
    } catch {
      return null;
    }
  }
}
