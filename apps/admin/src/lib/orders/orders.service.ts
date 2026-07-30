import "server-only";

import {
  runNotificationSafely,
  sendTelegramTextMessage,
} from "@kids-store/core";
import { prisma, type Prisma } from "@kids-store/database";
import {
  adminOrderQuerySchema,
  adminOrderStatusSchema,
  formatCustomerOrderStatusUpdate,
  type AdminOrderQuery,
  type AdminOrderStatus,
} from "@kids-store/shared";
import { z } from "zod";

import { createAdminAuditLog } from "../audit/audit.service";
import { AdminServiceError } from "../errors/admin-service-error";
import { getAdminServerEnv } from "../env/server";
import {
  canTransitionOrderStatus,
  shouldRestoreStock,
} from "./order-transitions";

const orderIdSchema = z.coerce.number().int().positive();
const adminIdSchema = z.string().regex(/^[1-9]\d*$/);

export interface AdminOrderListPage {
  data: {
    id: number;
    status: AdminOrderStatus;
    totalAmount: number;
    createdAt: string;
    customer: {
      name: string;
      phone: string | null;
    };
    itemsCount: number;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminOrderDetail {
  id: number;
  status: AdminOrderStatus;
  totalAmount: number;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: number;
    telegramUserId: string;
    username: string | null;
    firstName: string;
    phone: string | null;
  };
  items: {
    id: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productVariant: {
      id: number;
      size: string;
      color: string;
      product: {
        id: number;
        code: string;
        name: string;
      };
    };
  }[];
  history: {
    id: number;
    adminTelegramId: string;
    action: string;
    metadata: Prisma.JsonValue;
    createdAt: string;
  }[];
}

function tashkentDateStart(value: string): Date {
  return new Date(`${value}T00:00:00+05:00`);
}

function tashkentDateEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999+05:00`);
}

export async function listAdminOrders(
  queryInput: unknown,
): Promise<AdminOrderListPage> {
  const query: AdminOrderQuery = adminOrderQuerySchema.parse(queryInput);
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.orderId ? { id: query.orderId } : {}),
    ...(query.minAmount !== undefined || query.maxAmount !== undefined
      ? {
          totalAmount: {
            ...(query.minAmount !== undefined
              ? { gte: query.minAmount }
              : {}),
            ...(query.maxAmount !== undefined
              ? { lte: query.maxAmount }
              : {}),
          },
        }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom
              ? { gte: tashkentDateStart(query.dateFrom) }
              : {}),
            ...(query.dateTo
              ? { lte: tashkentDateEnd(query.dateTo) }
              : {}),
          },
        }
      : {}),
    ...(query.customer
      ? {
          customer: {
            OR: [
              {
                firstName: {
                  contains: query.customer,
                  mode: "insensitive",
                },
              },
              {
                username: {
                  contains: query.customer,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: query.customer,
                },
              },
            ],
          },
        }
      : {}),
  };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: {
            firstName: true,
            username: true,
            phone: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
  ]);

  return {
    data: orders.map((order) => ({
      id: order.id,
      status: adminOrderStatusSchema.parse(order.status),
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
      customer: {
        name: order.customer.username ?? order.customer.firstName,
        phone: order.customer.phone,
      },
      itemsCount: order._count.items,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getAdminOrder(
  orderIdInput: unknown,
): Promise<AdminOrderDetail | null> {
  const orderId = orderIdSchema.parse(orderIdInput);
  const [order, history] = await Promise.all([
    prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
      id: true,
      status: true,
      totalAmount: true,
      deliveryAddress: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          telegramUserId: true,
          username: true,
          firstName: true,
          phone: true,
        },
      },
      items: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          productVariant: {
            select: {
              id: true,
              size: true,
              color: true,
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        entityType: "Order",
        entityId: String(orderId),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        adminTelegramId: true,
        action: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return order
    ? {
        ...order,
        status: adminOrderStatusSchema.parse(order.status),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        customer: {
          ...order.customer,
          telegramUserId: order.customer.telegramUserId.toString(),
        },
        items: order.items.map((item) => ({
          ...item,
          subtotal: item.quantity * item.unitPrice,
        })),
        history: history.map((entry) => ({
          ...entry,
          adminTelegramId: entry.adminTelegramId.toString(),
          createdAt: entry.createdAt.toISOString(),
        })),
      }
    : null;
}

async function notifyCustomer(
  telegramUserId: string,
  orderId: number,
  status: string,
): Promise<void> {
  await runNotificationSafely(
    () =>
      sendTelegramTextMessage({
        botToken: getAdminServerEnv().TELEGRAM_BOT_TOKEN,
        chatId: telegramUserId,
        text: formatCustomerOrderStatusUpdate({ orderId, status }),
      }),
    (error) => {
      console.error(
        JSON.stringify({
          event: "admin_order_notification_failed",
          errorName:
            error instanceof Error ? error.name : "UnknownError",
          orderId,
        }),
      );
    },
  );
}

export async function updateAdminOrderStatus(
  adminTelegramIdInput: unknown,
  orderIdInput: unknown,
  nextStatusInput: unknown,
): Promise<{
  id: number;
  status: AdminOrderStatus;
  wasDuplicate: boolean;
}> {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const orderId = orderIdSchema.parse(orderIdInput);
  const nextStatus: AdminOrderStatus =
    adminOrderStatusSchema.parse(nextStatusInput);
  const result = await prisma.$transaction(
    async (transaction) => {
      const current = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          status: true,
          customer: {
            select: {
              telegramUserId: true,
            },
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
        throw new AdminServiceError(
          "ORDER_NOT_FOUND",
          "Buyurtma topilmadi.",
          404,
        );
      }

      if (current.status === nextStatus) {
        return {
          id: current.id,
          status: adminOrderStatusSchema.parse(current.status),
          telegramUserId: current.customer.telegramUserId.toString(),
          wasDuplicate: true,
        };
      }

      if (!canTransitionOrderStatus(current.status, nextStatus)) {
        throw new AdminServiceError(
          "INVALID_ORDER_TRANSITION",
          "Bu status o‘zgarishiga ruxsat berilmagan.",
          409,
        );
      }

      const updated = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: current.status,
        },
        data: {
          status: nextStatus,
        },
      });

      if (updated.count !== 1) {
        throw new AdminServiceError(
          "ORDER_CONCURRENT_UPDATE",
          "Buyurtma boshqa jarayonda yangilandi. Qayta urinib ko‘ring.",
          409,
        );
      }

      if (shouldRestoreStock(current.status, nextStatus)) {
        for (const item of current.items) {
          await transaction.productVariant.update({
            where: {
              id: item.productVariantId,
            },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      await createAdminAuditLog(transaction, {
        adminTelegramId,
        action:
          nextStatus === "CANCELLED"
            ? "order_cancelled"
            : "order_status_changed",
        entityType: "Order",
        entityId: orderId,
        metadata: {
          oldStatus: current.status,
          newStatus: nextStatus,
          stockRestored: shouldRestoreStock(
            current.status,
            nextStatus,
          ),
        },
      });

      return {
        id: current.id,
        status: nextStatus,
        telegramUserId: current.customer.telegramUserId.toString(),
        wasDuplicate: false,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );

  if (!result.wasDuplicate) {
    await notifyCustomer(
      result.telegramUserId,
      result.id,
      result.status,
    );
  }

  return {
    id: result.id,
    status: result.status,
    wasDuplicate: result.wasDuplicate,
  };
}
