import "server-only";

import { prisma } from "@kids-store/database";
import {
  adminCategoryInputSchema,
  type AdminCategoryInput,
} from "@kids-store/shared";
import { z } from "zod";

import { createAdminAuditLog } from "../audit/audit.service";
import { AdminServiceError } from "../errors/admin-service-error";
import { isPrismaUniqueConstraintError } from "../products/product-domain";

const categoryIdSchema = z.coerce.number().int().positive();
const adminIdSchema = z.string().regex(/^[1-9]\d*$/);

function mapCategoryError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throw new AdminServiceError(
      "CATEGORY_UNIQUE_CONFLICT",
      "Kategoriya nomi yoki slug band.",
      409,
      error,
    );
  }

  throw error;
}

export async function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });
}

export async function createAdminCategory(
  adminTelegramIdInput: unknown,
  input: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const categoryInput: AdminCategoryInput =
    adminCategoryInputSchema.parse(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const category = await transaction.category.create({
        data: categoryInput,
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
      await createAdminAuditLog(transaction, {
        adminTelegramId,
        action: "category_created",
        entityType: "Category",
        entityId: category.id,
        metadata: {
          name: category.name,
          slug: category.slug,
        },
      });

      return category;
    });
  } catch (error) {
    return mapCategoryError(error);
  }
}

export async function updateAdminCategory(
  adminTelegramIdInput: unknown,
  categoryIdInput: unknown,
  input: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const categoryId = categoryIdSchema.parse(categoryIdInput);
  const categoryInput: AdminCategoryInput =
    adminCategoryInputSchema.parse(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.category.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          name: true,
          slug: true,
        },
      });

      if (!existing) {
        throw new AdminServiceError(
          "CATEGORY_NOT_FOUND",
          "Kategoriya topilmadi.",
          404,
        );
      }

      const category = await transaction.category.update({
        where: {
          id: categoryId,
        },
        data: categoryInput,
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
      await createAdminAuditLog(transaction, {
        adminTelegramId,
        action: "category_updated",
        entityType: "Category",
        entityId: category.id,
        metadata: {
          old: existing,
          new: categoryInput,
        },
      });

      return category;
    });
  } catch (error) {
    return mapCategoryError(error);
  }
}
