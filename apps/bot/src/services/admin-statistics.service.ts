import { z } from "zod";

import {
  adminStatisticsPeriodSchema,
  type AdminStatisticsPeriod,
} from "../config/admin-statistics.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1_000;
const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
const statisticsRangeSchema = z
  .object({
    start: z.date(),
    end: z.date(),
  })
  .refine((range) => range.start <= range.end, {
    message: "Statistika boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak",
  });
const statisticsSnapshotSchema = z.object({
  activeProducts: z.number().int().nonnegative(),
  channelPosts: z.number().int().nonnegative(),
  currentPendingOrders: z.number().int().nonnegative(),
  lowStockVariants: z.number().int().nonnegative(),
  newCustomers: z.number().int().nonnegative(),
  orderValue: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  outOfStockVariants: z.number().int().nonnegative(),
  soldUnits: z.number().int().nonnegative(),
  statusCounts: z.array(
    z.object({
      count: z.number().int().nonnegative(),
      status: orderStatusSchema,
    }),
  ),
  topVariants: z
    .array(
      z.object({
        color: z.string().trim().min(1).max(80),
        productName: z.string().trim().min(1).max(160),
        quantity: z.number().int().positive(),
        size: z.string().trim().min(1).max(50),
      }),
    )
    .max(5),
});

export interface AdminStatisticsRange {
  end: Date;
  start: Date;
}

export interface AdminStatisticsSnapshot {
  activeProducts: number;
  channelPosts: number;
  currentPendingOrders: number;
  lowStockVariants: number;
  newCustomers: number;
  orderValue: number;
  orders: number;
  outOfStockVariants: number;
  soldUnits: number;
  statusCounts: {
    count: number;
    status: z.infer<typeof orderStatusSchema>;
  }[];
  topVariants: {
    color: string;
    productName: string;
    quantity: number;
    size: string;
  }[];
}

export interface AdminStatisticsReport extends AdminStatisticsSnapshot {
  generatedAt: Date;
  period: AdminStatisticsPeriod;
  rangeStart: Date;
}

export interface AdminStatisticsRepository {
  load(range: AdminStatisticsRange): Promise<AdminStatisticsSnapshot>;
}

function startOfTashkentDay(now: Date): Date {
  const tashkentDate = new Date(now.getTime() + TASHKENT_OFFSET_MS);

  return new Date(
    Date.UTC(
      tashkentDate.getUTCFullYear(),
      tashkentDate.getUTCMonth(),
      tashkentDate.getUTCDate(),
    ) - TASHKENT_OFFSET_MS,
  );
}

export function getAdminStatisticsRange(
  periodInput: unknown,
  nowInput: unknown = new Date(),
): AdminStatisticsRange {
  const period = adminStatisticsPeriodSchema.parse(periodInput);
  const now = z.date().parse(nowInput);
  const todayStart = startOfTashkentDay(now);
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;

  return statisticsRangeSchema.parse({
    start: new Date(todayStart.getTime() - (days - 1) * DAY_MS),
    end: now,
  });
}

const prismaAdminStatisticsRepository: AdminStatisticsRepository = {
  async load(rangeInput) {
    const { prisma } = await import("@kids-store/database");
    const range = statisticsRangeSchema.parse(rangeInput);
    const periodWhere = {
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    };
    const completedOrderWhere = {
      order: {
        ...periodWhere,
        status: {
          not: "CANCELLED" as const,
        },
      },
    };
    const [
      orderValue,
      statusCounts,
      newCustomers,
      soldUnits,
      currentPendingOrders,
      activeProducts,
      lowStockVariants,
      outOfStockVariants,
      channelPosts,
      topVariantRows,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          ...periodWhere,
          status: {
            not: "CANCELLED",
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: periodWhere,
        _count: {
          _all: true,
        },
      }),
      prisma.customer.count({ where: periodWhere }),
      prisma.orderItem.aggregate({
        where: completedOrderWhere,
        _sum: {
          quantity: true,
        },
      }),
      prisma.order.count({
        where: {
          status: {
            in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"],
          },
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
            gt: 0,
            lte: 5,
          },
          product: {
            isActive: true,
          },
        },
      }),
      prisma.productVariant.count({
        where: {
          stock: 0,
          product: {
            isActive: true,
          },
        },
      }),
      prisma.channelPost.count({ where: periodWhere }),
      prisma.orderItem.groupBy({
        by: ["productVariantId"],
        where: completedOrderWhere,
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 5,
      }),
    ]);
    const variantIds = topVariantRows.map(
      (row) => row.productVariantId,
    );
    const variants =
      variantIds.length === 0
        ? []
        : await prisma.productVariant.findMany({
            where: {
              id: {
                in: variantIds,
              },
            },
            select: {
              id: true,
              size: true,
              color: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          });
    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    return statisticsSnapshotSchema.parse({
      activeProducts,
      channelPosts,
      currentPendingOrders,
      lowStockVariants,
      newCustomers,
      orderValue: orderValue._sum.totalAmount ?? 0,
      orders: statusCounts.reduce(
        (total, row) => total + row._count._all,
        0,
      ),
      outOfStockVariants,
      soldUnits: soldUnits._sum.quantity ?? 0,
      statusCounts: statusCounts.map((row) => ({
        count: row._count._all,
        status: row.status,
      })),
      topVariants: topVariantRows.flatMap((row) => {
        const variant = variantsById.get(row.productVariantId);
        const quantity = row._sum.quantity;

        return variant === undefined || quantity === null || quantity <= 0
          ? []
          : [
              {
                color: variant.color,
                productName: variant.product.name,
                quantity,
                size: variant.size,
              },
            ];
      }),
    });
  },
};

export class AdminStatisticsService {
  constructor(
    private readonly repository: AdminStatisticsRepository =
      prismaAdminStatisticsRepository,
  ) {}

  async getStatistics(
    periodInput: unknown,
    nowInput: unknown = new Date(),
  ): Promise<AdminStatisticsReport> {
    const period = adminStatisticsPeriodSchema.parse(periodInput);
    const generatedAt = z.date().parse(nowInput);
    const range = getAdminStatisticsRange(period, generatedAt);
    const snapshot = statisticsSnapshotSchema.parse(
      await this.repository.load(range),
    );

    return {
      ...snapshot,
      generatedAt,
      period,
      rangeStart: range.start,
    };
  }
}
