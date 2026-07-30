import "server-only";

import { prisma } from "@kids-store/database";

import { getTashkentDayRange } from "../time/tashkent";

export interface AdminDashboardDto {
  metrics: {
    todayOrders: number;
    todayRevenue: number;
    newOrders: number;
    activeProducts: number;
    lowStockVariants: number;
  };
  recentOrders: {
    id: number;
    createdAt: string;
    customerName: string;
    itemsCount: number;
    status: string;
    totalAmount: number;
  }[];
  recentChannelPosts: {
    id: number;
    createdAt: string;
    messageId: number;
    productId: number;
    productName: string;
  }[];
}

export async function getAdminDashboard(
  now = new Date(),
): Promise<AdminDashboardDto> {
  const { start, end } = getTashkentDayRange(now);
  const todayWhere = {
    createdAt: {
      gte: start,
      lt: end,
    },
  };
  const [
    todayOrders,
    revenue,
    newOrders,
    activeProducts,
    lowStockVariants,
    recentOrders,
    recentChannelPosts,
  ] = await Promise.all([
    prisma.order.count({ where: todayWhere }),
    prisma.order.aggregate({
      where: {
        ...todayWhere,
        status: {
          not: "CANCELLED",
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.product.count({
      where: {
        isActive: true,
      },
    }),
    prisma.productVariant.count({
      where: {
        stock: {
          lte: 5,
        },
        product: {
          isActive: true,
        },
      },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: {
            firstName: true,
            username: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.channelPost.findMany({
      take: 10,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        telegramMessageId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      todayOrders,
      todayRevenue: revenue._sum.totalAmount ?? 0,
      newOrders,
      activeProducts,
      lowStockVariants,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      customerName:
        order.customer.username ?? order.customer.firstName,
      itemsCount: order._count.items,
      status: order.status,
      totalAmount: order.totalAmount,
    })),
    recentChannelPosts: recentChannelPosts.map((post) => ({
      id: post.id,
      createdAt: post.createdAt.toISOString(),
      messageId: post.telegramMessageId,
      productId: post.product.id,
      productName: post.product.name,
    })),
  };
}
