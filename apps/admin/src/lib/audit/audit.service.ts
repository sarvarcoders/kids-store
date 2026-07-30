import "server-only";

import { prisma, type Prisma } from "@kids-store/database";
import {
  adminAuditQuerySchema,
  type AdminAuditQuery,
} from "@kids-store/shared";
import { z } from "zod";

const auditInputSchema = z.object({
  adminTelegramId: z.string().regex(/^[1-9]\d*$/),
  action: z.string().trim().min(1).max(80),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.union([
    z.string().trim().min(1).max(100),
    z.number().int().nonnegative(),
  ]),
  metadata: z.unknown(),
});

const sensitiveKeyPattern =
  /(token|secret|password|authorization|cookie|initdata|hash)/i;

function sanitizeValue(
  value: unknown,
  depth = 0,
): Prisma.InputJsonValue {
  if (depth > 4) {
    return "[TRUNCATED]";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value.length <= 500 ? value : `${value.slice(0, 499)}…`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
      .slice(0, 50)
      .map(
        ([key, nestedValue]) =>
          [
            key,
            sensitiveKeyPattern.test(key)
              ? "[MASKED]"
              : sanitizeValue(nestedValue, depth + 1),
          ] as const,
      );

    return Object.fromEntries(entries);
  }

  if (typeof value === "symbol") {
    return value.description ?? "[SYMBOL]";
  }

  if (typeof value === "undefined") {
    return "[UNDEFINED]";
  }

  return "[UNSUPPORTED]";
}

export async function createAdminAuditLog(
  transaction: Prisma.TransactionClient,
  input: unknown,
): Promise<void> {
  const parsed = auditInputSchema.parse(input);

  await transaction.adminAuditLog.create({
    data: {
      adminTelegramId: BigInt(parsed.adminTelegramId),
      action: parsed.action,
      entityType: parsed.entityType,
      entityId: String(parsed.entityId),
      metadata: sanitizeValue(parsed.metadata),
    },
  });
}

export async function appendAdminAuditLog(input: unknown): Promise<void> {
  await prisma.$transaction((transaction) =>
    createAdminAuditLog(transaction, input),
  );
}

export async function listAdminAuditLogs(
  queryInput: unknown,
): Promise<{
  data: {
    id: number;
    adminTelegramId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Prisma.JsonValue;
    createdAt: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const query: AdminAuditQuery = adminAuditQuerySchema.parse(queryInput);
  const start = query.dateFrom
    ? new Date(`${query.dateFrom}T00:00:00.000Z`)
    : undefined;
  const end = query.dateTo
    ? new Date(`${query.dateTo}T23:59:59.999Z`)
    : undefined;
  const where = {
    ...(query.adminTelegramId
      ? { adminTelegramId: BigInt(query.adminTelegramId) }
      : {}),
    ...(query.action
      ? { action: { contains: query.action, mode: "insensitive" as const } }
      : {}),
    ...(query.entityType
      ? {
          entityType: {
            contains: query.entityType,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        adminTelegramId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    data: rows.map((row) => ({
      ...row,
      adminTelegramId: row.adminTelegramId.toString(),
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
