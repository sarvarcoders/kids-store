import "server-only";

import { prisma } from "@kids-store/database";
import {
  orderDetailDtoSchema,
  orderListItemDtoSchema,
  orderQuerySchema,
  verifiedTelegramUserDtoSchema,
  type OrderDetailDto,
  type OrderListItemDto,
  type OrderQuery,
} from "@kids-store/shared";

import { upsertTelegramCustomer } from "../cart/cart.service";
import { createOwnedOrderWhere } from "../auth/ownership";

export interface OrderPage {
  data: OrderListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

async function getCustomerId(userInput: unknown): Promise<number> {
  const user = verifiedTelegramUserDtoSchema.parse(userInput);

  return prisma.$transaction((transaction) =>
    upsertTelegramCustomer(transaction, user),
  );
}

export async function listOrdersForTelegramUser(
  userInput: unknown,
  queryInput: unknown,
): Promise<OrderPage> {
  const query: OrderQuery = orderQuerySchema.parse(queryInput);
  const customerId = await getCustomerId(userInput);
  const where = {
    customerId,
  };
  const skip = (query.page - 1) * query.limit;
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    data: orders.map((order) =>
      orderListItemDtoSchema.parse({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toISOString(),
        productsCount: order._count.items,
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    },
  };
}

export async function getOrderForTelegramUser(
  userInput: unknown,
  orderId: number,
): Promise<OrderDetailDto | null> {
  const customerId = await getCustomerId(userInput);
  const order = await prisma.order.findFirst({
    where: createOwnedOrderWhere(customerId, orderId),
    select: {
      id: true,
      status: true,
      totalAmount: true,
      deliveryAddress: true,
      createdAt: true,
      customer: {
        select: {
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
    },
  });

  if (!order?.deliveryAddress || !order.customer.phone) {
    return null;
  }

  return orderDetailDtoSchema.parse({
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
