import "server-only";

import { prisma, type Prisma } from "@kids-store/database";
import {
  adminCustomerQuerySchema,
  type AdminCustomerQuery,
} from "@kids-store/shared";
import { z } from "zod";

const customerIdSchema = z.coerce.number().int().positive();

interface AdminCustomerDetail {
  id: number;
  telegramUserId: string;
  username: string | null;
  firstName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  totalSpent: number;
  orders: {
    id: number;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
  cart: {
    id: number;
    updatedAt: string;
    items: {
      id: number;
      quantity: number;
      productVariant: {
        size: string;
        color: string;
        product: {
          name: string;
        };
      };
    }[];
  } | null;
}

function parseTelegramSearch(search: string | undefined): bigint | null {
  if (!search || !/^[1-9]\d{0,18}$/.test(search)) {
    return null;
  }

  try {
    const value = BigInt(search);
    return value <= 9_223_372_036_854_775_807n ? value : null;
  } catch {
    return null;
  }
}

export async function listAdminCustomers(queryInput: unknown) {
  const query: AdminCustomerQuery =
    adminCustomerQuerySchema.parse(queryInput);
  const telegramId = parseTelegramSearch(query.search);
  const where: Prisma.CustomerWhereInput = query.search
    ? {
        OR: [
          {
            firstName: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            username: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: query.search,
            },
          },
          ...(telegramId === null
            ? []
            : [{ telegramUserId: telegramId }]),
        ],
      }
    : {};
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        telegramUserId: true,
        username: true,
        firstName: true,
        phone: true,
        createdAt: true,
      },
    }),
  ]);
  const customerIds = customers.map((customer) => customer.id);
  const aggregates =
    customerIds.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["customerId"],
          where: {
            customerId: {
              in: customerIds,
            },
            status: {
              not: "CANCELLED",
            },
          },
          _count: {
            id: true,
          },
          _sum: {
            totalAmount: true,
          },
          _max: {
            createdAt: true,
          },
        });
  const aggregatesByCustomer = new Map(
    aggregates.map((aggregate) => [
      aggregate.customerId,
      aggregate,
    ]),
  );

  return {
    data: customers.map((customer) => {
      const aggregate = aggregatesByCustomer.get(customer.id);

      return {
        id: customer.id,
        telegramUserId: customer.telegramUserId.toString(),
        username: customer.username,
        firstName: customer.firstName,
        phone: customer.phone,
        createdAt: customer.createdAt.toISOString(),
        orderCount: aggregate?._count.id ?? 0,
        totalSpent: aggregate?._sum.totalAmount ?? 0,
        lastOrderAt:
          aggregate?._max.createdAt?.toISOString() ?? null,
      };
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getAdminCustomer(
  customerIdInput: unknown,
): Promise<AdminCustomerDetail | null> {
  const customerId = customerIdSchema.parse(customerIdInput);
  const [customer, total] = await Promise.all([
    prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        telegramUserId: true,
        username: true,
        firstName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        cart: {
          select: {
            id: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                quantity: true,
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
          },
        },
      },
    }),
    prisma.order.aggregate({
      where: {
        customerId,
        status: {
          not: "CANCELLED",
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  if (!customer) {
    return null;
  }

  return {
    ...customer,
    telegramUserId: customer.telegramUserId.toString(),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    totalSpent: total._sum.totalAmount ?? 0,
    orders: customer.orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
    cart: customer.cart
      ? {
          ...customer.cart,
          updatedAt: customer.cart.updatedAt.toISOString(),
        }
      : null,
  };
}
