import type { Prisma } from "@kids-store/database";
import {
  canTransitionOrderStatus,
  orderStatusSchema,
  shouldRestoreStock,
  type OrderStatus,
} from "@kids-store/shared";
import { z } from "zod";

import { databaseIdSchema } from "../config/validation.js";

const adminTelegramIdSchema = z
  .union([z.string(), z.number().int().positive()])
  .transform((value) => String(value))
  .pipe(z.string().regex(/^[1-9]\d*$/));
const listLimitSchema = z.number().int().min(1).max(10);
const ADMIN_ORDER_TRANSACTION_MAX_WAIT_MS = 5_000;
const ADMIN_ORDER_TRANSACTION_TIMEOUT_MS = 10_000;
const ADMIN_ORDER_TRANSACTION_RETRY_DELAYS_MS = [250, 750] as const;
export const adminManagedOrderSchema = z.object({
  id: databaseIdSchema,
  status: orderStatusSchema,
  totalAmount: z.number().int().nonnegative(),
  deliveryAddress: z.string().trim().min(1).max(500).nullable(),
  createdAt: z.date(),
  contactedAt: z.date().nullable(),
  customer: z.object({
    telegramUserId: z.bigint().positive(),
    username: z.string().trim().min(1).max(32).nullable(),
    firstName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(32).nullable(),
  }),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative(),
        productVariant: z.object({
          size: z.string().trim().min(1).max(50),
          color: z.string().trim().min(1).max(80),
          product: z.object({
            name: z.string().trim().min(1).max(160),
          }),
        }),
      }),
    )
    .min(1),
});

export type AdminManagedOrder = z.infer<
  typeof adminManagedOrderSchema
>;

export interface AdminOpenOrderList {
  orders: AdminManagedOrder[];
  total: number;
}

export type AdminOrderServiceErrorCode =
  | "ORDER_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "CONCURRENT_UPDATE";

export class AdminOrderServiceError extends Error {
  constructor(
    readonly code: AdminOrderServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminOrderServiceError";
  }
}

export interface AdminOrderRepository {
  findById(orderId: number): Promise<AdminManagedOrder | null>;
  listOpen(limit: number): Promise<AdminOpenOrderList>;
  markCustomerContacted(
    adminTelegramId: string,
    orderId: number,
  ): Promise<{ wasDuplicate: boolean }>;
  transition(
    adminTelegramId: string,
    orderId: number,
    nextStatus: OrderStatus,
  ): Promise<{
    customerTelegramUserId: bigint;
    wasDuplicate: boolean;
  }>;
}

const managedOrderSelect = {
  id: true,
  status: true,
  totalAmount: true,
  deliveryAddress: true,
  createdAt: true,
  customer: {
    select: {
      telegramUserId: true,
      username: true,
      firstName: true,
      phone: true,
    },
  },
  items: {
    orderBy: {
      id: "asc" as const,
    },
    select: {
      quantity: true,
      unitPrice: true,
      productVariant: {
        select: {
          size: true,
          color: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} as const;

function parseManagedOrder(
  order: unknown,
  contactedAt: Date | null,
): AdminManagedOrder {
  return adminManagedOrderSchema.parse({
    ...(typeof order === "object" && order !== null ? order : {}),
    contactedAt,
  });
}

function isPrismaTransactionConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  );
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

export function isRetryableAdminOrderTransactionError(
  error: unknown,
): boolean {
  const code = getErrorCode(error);

  if (code === "P2028" || code === "P2034") {
    return true;
  }

  return (
    error instanceof Error &&
    error.message.includes(
      "Unable to start a transaction in the given time",
    )
  );
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function runAdminOrderTransactionWithRetry<T>(
  operation: () => Promise<T>,
  wait: (delayMs: number) => Promise<void> = waitForRetry,
): Promise<T> {
  for (
    let attempt = 0;
    attempt <= ADMIN_ORDER_TRANSACTION_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error) {
      const retryDelay = ADMIN_ORDER_TRANSACTION_RETRY_DELAYS_MS[attempt];

      if (
        retryDelay === undefined ||
        !isRetryableAdminOrderTransactionError(error)
      ) {
        throw error;
      }

      await wait(retryDelay);
    }
  }

  throw new Error("Admin order transaction retry chegarasi buzildi");
}

const prismaAdminOrderRepository: AdminOrderRepository = {
  async findById(orderIdInput) {
    const { prisma } = await import("@kids-store/database");
    const orderId = databaseIdSchema.parse(orderIdInput);
    const [order, contactLog] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: managedOrderSelect,
      }),
      prisma.adminAuditLog.findFirst({
        where: {
          action: "order_customer_contacted",
          entityType: "Order",
          entityId: String(orderId),
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    return order
      ? parseManagedOrder(order, contactLog?.createdAt ?? null)
      : null;
  },

  async listOpen(limitInput) {
    const { prisma } = await import("@kids-store/database");
    const limit = listLimitSchema.parse(limitInput);
    const openOrderWhere: Prisma.OrderWhereInput = {
      status: {
        in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"],
      },
    };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where: openOrderWhere }),
      prisma.order.findMany({
        where: openOrderWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
        select: managedOrderSelect,
      }),
    ]);
    const orderIds = orders.map((order) => String(order.id));
    const contactLogs =
      orderIds.length === 0
        ? []
        : await prisma.adminAuditLog.findMany({
            where: {
              action: "order_customer_contacted",
              entityType: "Order",
              entityId: { in: orderIds },
            },
            orderBy: { createdAt: "asc" },
            select: {
              entityId: true,
              createdAt: true,
            },
          });
    const contactedAtByOrderId = new Map<string, Date>();

    for (const log of contactLogs) {
      if (!contactedAtByOrderId.has(log.entityId)) {
        contactedAtByOrderId.set(log.entityId, log.createdAt);
      }
    }

    return {
      orders: orders.map((order) =>
        parseManagedOrder(
          order,
          contactedAtByOrderId.get(String(order.id)) ?? null,
        ),
      ),
      total,
    };
  },

  async markCustomerContacted(adminTelegramIdInput, orderIdInput) {
    const { prisma } = await import("@kids-store/database");
    const adminTelegramId = adminTelegramIdSchema.parse(
      adminTelegramIdInput,
    );
    const orderId = databaseIdSchema.parse(orderIdInput);

    return runAdminOrderTransactionWithRetry(() =>
      prisma.$transaction(
        async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { id: orderId },
          select: { id: true },
        });

        if (!order) {
          throw new AdminOrderServiceError(
            "ORDER_NOT_FOUND",
            "Buyurtma topilmadi",
          );
        }

        const existing = await transaction.adminAuditLog.findFirst({
          where: {
            action: "order_customer_contacted",
            entityType: "Order",
            entityId: String(orderId),
          },
          select: { id: true },
        });

        if (existing) {
          return { wasDuplicate: true };
        }

        await transaction.adminAuditLog.create({
          data: {
            adminTelegramId: BigInt(adminTelegramId),
            action: "order_customer_contacted",
            entityType: "Order",
            entityId: String(orderId),
            metadata: {
              source: "telegram_bot",
            } satisfies Prisma.InputJsonObject,
          },
        });

        return { wasDuplicate: false };
        },
        {
          isolationLevel: "Serializable",
          maxWait: ADMIN_ORDER_TRANSACTION_MAX_WAIT_MS,
          timeout: ADMIN_ORDER_TRANSACTION_TIMEOUT_MS,
        },
      ),
    ).catch((error: unknown) => {
      if (isPrismaTransactionConflict(error)) {
        throw new AdminOrderServiceError(
          "CONCURRENT_UPDATE",
          "Buyurtma parallel yangilandi",
        );
      }

      throw error;
    });
  },

  async transition(
    adminTelegramIdInput,
    orderIdInput,
    nextStatusInput,
  ) {
    const { prisma } = await import("@kids-store/database");
    const adminTelegramId = adminTelegramIdSchema.parse(
      adminTelegramIdInput,
    );
    const orderId = databaseIdSchema.parse(orderIdInput);
    const nextStatus = orderStatusSchema.parse(nextStatusInput);

    return runAdminOrderTransactionWithRetry(() =>
      prisma.$transaction(
        async (transaction) => {
        const current = await transaction.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            customer: {
              select: { telegramUserId: true },
            },
            items: {
              select: {
                quantity: true,
                productVariantId: true,
              },
            },
          },
        });

        if (!current) {
          throw new AdminOrderServiceError(
            "ORDER_NOT_FOUND",
            "Buyurtma topilmadi",
          );
        }

        if (current.status === nextStatus) {
          return {
            customerTelegramUserId: current.customer.telegramUserId,
            wasDuplicate: true,
          };
        }

        if (!canTransitionOrderStatus(current.status, nextStatus)) {
          throw new AdminOrderServiceError(
            "INVALID_TRANSITION",
            "Bu status o‘zgarishiga ruxsat berilmagan",
          );
        }

        const updated = await transaction.order.updateMany({
          where: {
            id: orderId,
            status: current.status,
          },
          data: { status: nextStatus },
        });

        if (updated.count !== 1) {
          throw new AdminOrderServiceError(
            "CONCURRENT_UPDATE",
            "Buyurtma boshqa admin tomonidan yangilandi",
          );
        }

        const stockRestored = shouldRestoreStock(
          current.status,
          nextStatus,
        );

        if (stockRestored) {
          for (const item of current.items) {
            await transaction.productVariant.update({
              where: { id: item.productVariantId },
              data: {
                stock: { increment: item.quantity },
              },
            });
          }
        }

        await transaction.adminAuditLog.create({
          data: {
            adminTelegramId: BigInt(adminTelegramId),
            action:
              nextStatus === "CANCELLED"
                ? "order_cancelled"
                : "order_status_changed",
            entityType: "Order",
            entityId: String(orderId),
            metadata: {
              source: "telegram_bot",
              oldStatus: current.status,
              newStatus: nextStatus,
              stockRestored,
            } satisfies Prisma.InputJsonObject,
          },
        });

        return {
          customerTelegramUserId: current.customer.telegramUserId,
          wasDuplicate: false,
        };
        },
        {
          isolationLevel: "Serializable",
          maxWait: ADMIN_ORDER_TRANSACTION_MAX_WAIT_MS,
          timeout: ADMIN_ORDER_TRANSACTION_TIMEOUT_MS,
        },
      ),
    ).catch((error: unknown) => {
      if (isPrismaTransactionConflict(error)) {
        throw new AdminOrderServiceError(
          "CONCURRENT_UPDATE",
          "Buyurtma parallel yangilandi",
        );
      }

      throw error;
    });
  },
};

export class AdminOrderService {
  constructor(
    private readonly repository: AdminOrderRepository =
      prismaAdminOrderRepository,
  ) {}

  listOpenOrders(limitInput: unknown = 10): Promise<AdminOpenOrderList> {
    const limit = listLimitSchema.parse(limitInput);

    return this.repository.listOpen(limit);
  }

  getOrder(orderIdInput: unknown): Promise<AdminManagedOrder | null> {
    const orderId = databaseIdSchema.parse(orderIdInput);

    return this.repository.findById(orderId);
  }

  async markCustomerContacted(
    adminTelegramIdInput: unknown,
    orderIdInput: unknown,
  ): Promise<{
    order: AdminManagedOrder;
    wasDuplicate: boolean;
  }> {
    const adminTelegramId = adminTelegramIdSchema.parse(
      adminTelegramIdInput,
    );
    const orderId = databaseIdSchema.parse(orderIdInput);
    let result: { wasDuplicate: boolean };

    try {
      result = await this.repository.markCustomerContacted(
        adminTelegramId,
        orderId,
      );
    } catch (error) {
      if (
        !(error instanceof AdminOrderServiceError) ||
        error.code !== "CONCURRENT_UPDATE"
      ) {
        throw error;
      }

      const concurrentOrder = await this.repository.findById(orderId);

      if (!concurrentOrder?.contactedAt) {
        throw error;
      }

      return { order: concurrentOrder, wasDuplicate: true };
    }
    const order = await this.repository.findById(orderId);

    if (!order) {
      throw new AdminOrderServiceError(
        "ORDER_NOT_FOUND",
        "Buyurtma topilmadi",
      );
    }

    return { order, wasDuplicate: result.wasDuplicate };
  }

  async transitionOrder(
    adminTelegramIdInput: unknown,
    orderIdInput: unknown,
    nextStatusInput: unknown,
  ): Promise<{
    customerTelegramUserId: bigint;
    order: AdminManagedOrder;
    wasDuplicate: boolean;
  }> {
    const adminTelegramId = adminTelegramIdSchema.parse(
      adminTelegramIdInput,
    );
    const orderId = databaseIdSchema.parse(orderIdInput);
    const nextStatus = orderStatusSchema.parse(nextStatusInput);
    let result: {
      customerTelegramUserId: bigint;
      wasDuplicate: boolean;
    };

    try {
      result = await this.repository.transition(
        adminTelegramId,
        orderId,
        nextStatus,
      );
    } catch (error) {
      if (
        !(error instanceof AdminOrderServiceError) ||
        error.code !== "CONCURRENT_UPDATE"
      ) {
        throw error;
      }

      const concurrentOrder = await this.repository.findById(orderId);

      if (concurrentOrder?.status !== nextStatus) {
        throw error;
      }

      return {
        customerTelegramUserId:
          concurrentOrder.customer.telegramUserId,
        order: concurrentOrder,
        wasDuplicate: true,
      };
    }
    const order = await this.repository.findById(orderId);

    if (!order) {
      throw new AdminOrderServiceError(
        "ORDER_NOT_FOUND",
        "Buyurtma topilmadi",
      );
    }

    return {
      ...result,
      order,
    };
  }
}
