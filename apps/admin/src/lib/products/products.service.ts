import "server-only";

import { prisma, type Prisma } from "@kids-store/database";
import {
  adminProductInputSchema,
  adminProductQuerySchema,
  type AdminProductInput,
  type AdminProductQuery,
} from "@kids-store/shared";
import { z } from "zod";

import { createAdminAuditLog } from "../audit/audit.service";
import { AdminServiceError } from "../errors/admin-service-error";
import {
  getProductActivationChange,
  getRemovedVariantStrategy,
  isPrismaUniqueConstraintError,
} from "./product-domain";

const productIdSchema = z.coerce.number().int().positive();
const adminIdSchema = z.string().regex(/^[1-9]\d*$/);

function mapProductWriteError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throw new AdminServiceError(
      "PRODUCT_UNIQUE_CONFLICT",
      "Mahsulot kodi, slug yoki variant kombinatsiyasi band.",
      409,
      error,
    );
  }

  throw error;
}

function productOrderBy(
  sort: AdminProductQuery["sort"],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function listAdminProducts(queryInput: unknown) {
  const query: AdminProductQuery =
    adminProductQuerySchema.parse(queryInput);
  const where: Prisma.ProductWhereInput = {
    ...(query.search
      ? {
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              code: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(query.categoryId
      ? { categoryId: query.categoryId }
      : {}),
    ...(query.active === undefined
      ? {}
      : { isActive: query.active }),
    ...(query.discount
      ? { discountPrice: { not: null } }
      : {}),
    ...(query.lowStock
      ? {
          variants: {
            some: {
              stock: {
                lte: 5,
              },
            },
          },
        }
      : {}),
  };
  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: productOrderBy(query.sort),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        discountPrice: true,
        isActive: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          take: 1,
          select: {
            url: true,
          },
        },
        variants: {
          select: {
            stock: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    data: products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      price: product.price,
      discountPrice: product.discountPrice,
      isActive: product.isActive,
      primaryImage: product.images[0]?.url ?? null,
      variantsCount: product.variants.length,
      totalStock: product.variants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      ),
    })),
    categories,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getAdminProduct(productIdInput: unknown) {
  const productId = productIdSchema.parse(productIdInput);

  return prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      discountPrice: true,
      isActive: true,
      categoryId: true,
      images: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          url: true,
          sortOrder: true,
        },
      },
      variants: {
        orderBy: [{ size: "asc" }, { color: "asc" }],
        select: {
          id: true,
          size: true,
          color: true,
          stock: true,
        },
      },
      channelPosts: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          telegramMessageId: true,
          telegramChannelId: true,
          createdAt: true,
        },
      },
    },
  });
}

async function assertCategoryExists(
  transaction: Prisma.TransactionClient,
  categoryId: number,
): Promise<void> {
  const category = await transaction.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new AdminServiceError(
      "CATEGORY_NOT_FOUND",
      "Tanlangan kategoriya topilmadi.",
      400,
    );
  }
}

export async function createAdminProduct(
  adminTelegramIdInput: unknown,
  input: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const productInput: AdminProductInput =
    adminProductInputSchema.parse(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      await assertCategoryExists(transaction, productInput.categoryId);
      const product = await transaction.product.create({
        data: {
          code: productInput.code,
          name: productInput.name,
          slug: productInput.slug,
          description: productInput.description,
          price: productInput.price,
          discountPrice: productInput.discountPrice,
          isActive: productInput.isActive,
          categoryId: productInput.categoryId,
          images: {
            create: productInput.images.map((image) => ({
              url: image.url,
              sortOrder: image.sortOrder,
            })),
          },
          variants: {
            create: productInput.variants.map((variant) => ({
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
            })),
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });
      await createAdminAuditLog(transaction, {
        adminTelegramId,
        action: "product_created",
        entityType: "Product",
        entityId: product.id,
        metadata: {
          code: product.code,
          name: product.name,
          variantsCount: productInput.variants.length,
          imagesCount: productInput.images.length,
          initialStock: productInput.variants.reduce(
            (sum, variant) => sum + variant.stock,
            0,
          ),
        },
      });

      return product;
    });
  } catch (error) {
    return mapProductWriteError(error);
  }
}

export async function updateAdminProduct(
  adminTelegramIdInput: unknown,
  productIdInput: unknown,
  input: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const productId = productIdSchema.parse(productIdInput);
  const productInput: AdminProductInput =
    adminProductInputSchema.parse(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          price: true,
          discountPrice: true,
          isActive: true,
          categoryId: true,
          variants: {
            select: {
              id: true,
              size: true,
              color: true,
              stock: true,
              _count: {
                select: {
                  orderItems: true,
                  cartItems: true,
                },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new AdminServiceError(
          "PRODUCT_NOT_FOUND",
          "Mahsulot topilmadi.",
          404,
        );
      }

      await assertCategoryExists(transaction, productInput.categoryId);
      const existingById = new Map(
        existing.variants.map((variant) => [variant.id, variant]),
      );
      const retainedIds = new Set<number>();

      for (const variant of productInput.variants) {
        if (variant.id === undefined) {
          continue;
        }

        if (!existingById.has(variant.id)) {
          throw new AdminServiceError(
            "INVALID_VARIANT",
            "Variant ushbu mahsulotga tegishli emas.",
            400,
          );
        }

        retainedIds.add(variant.id);
      }

      for (const variant of existing.variants) {
        if (retainedIds.has(variant.id)) {
          await transaction.productVariant.update({
            where: {
              id: variant.id,
            },
            data: {
              size: `__tmp_${String(variant.id)}`,
              color: `__tmp_${String(variant.id)}`,
            },
          });
          continue;
        }

        if (
          getRemovedVariantStrategy({
            orderItems: variant._count.orderItems,
            cartItems: variant._count.cartItems,
          }) === "zero_stock"
        ) {
          await transaction.productVariant.update({
            where: {
              id: variant.id,
            },
            data: {
              stock: 0,
            },
          });
        } else {
          await transaction.productVariant.delete({
            where: {
              id: variant.id,
            },
          });
        }
      }

      for (const variant of productInput.variants) {
        if (variant.id === undefined) {
          await transaction.productVariant.create({
            data: {
              productId,
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
            },
          });
        } else {
          await transaction.productVariant.update({
            where: {
              id: variant.id,
            },
            data: {
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
            },
          });
        }
      }

      await transaction.productImage.deleteMany({
        where: {
          productId,
        },
      });
      await transaction.product.update({
        where: {
          id: productId,
        },
        data: {
          code: productInput.code,
          name: productInput.name,
          slug: productInput.slug,
          description: productInput.description,
          price: productInput.price,
          discountPrice: productInput.discountPrice,
          isActive: productInput.isActive,
          categoryId: productInput.categoryId,
          images: {
            create: productInput.images.map((image) => ({
              url: image.url,
              sortOrder: image.sortOrder,
            })),
          },
        },
      });
      const stockChanges = productInput.variants
        .filter(
          (variant) =>
            variant.id !== undefined &&
            existingById.get(variant.id)?.stock !== variant.stock,
        )
        .map((variant) => ({
          variantId: variant.id,
          oldStock: existingById.get(variant.id ?? 0)?.stock,
          newStock: variant.stock,
        }));
      await createAdminAuditLog(transaction, {
        adminTelegramId,
        action: "product_updated",
        entityType: "Product",
        entityId: productId,
        metadata: {
          old: {
            code: existing.code,
            name: existing.name,
            slug: existing.slug,
            price: existing.price,
            discountPrice: existing.discountPrice,
            isActive: existing.isActive,
            categoryId: existing.categoryId,
          },
          new: {
            code: productInput.code,
            name: productInput.name,
            slug: productInput.slug,
            price: productInput.price,
            discountPrice: productInput.discountPrice,
            isActive: productInput.isActive,
            categoryId: productInput.categoryId,
          },
        },
      });

      if (stockChanges.length > 0) {
        await createAdminAuditLog(transaction, {
          adminTelegramId,
          action: "stock_changed",
          entityType: "Product",
          entityId: productId,
          metadata: {
            changes: stockChanges,
          },
        });
      }

      return {
        id: productId,
        name: productInput.name,
      };
    });
  } catch (error) {
    return mapProductWriteError(error);
  }
}

export async function setAdminProductActive(
  adminTelegramIdInput: unknown,
  productIdInput: unknown,
  isActiveInput: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const productId = productIdSchema.parse(productIdInput);
  const isActive = z.boolean().parse(isActiveInput);

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!current) {
      throw new AdminServiceError(
        "PRODUCT_NOT_FOUND",
        "Mahsulot topilmadi.",
        404,
      );
    }

    const activation = getProductActivationChange(
      current.isActive,
      isActive,
    );

    if (!activation.changed) {
      return current;
    }

    const product = await transaction.product.update({
      where: {
        id: productId,
      },
      data: {
        isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
    await createAdminAuditLog(transaction, {
      adminTelegramId,
      action: activation.action ?? "product_archived",
      entityType: "Product",
      entityId: productId,
      metadata: {
        old: current.isActive,
        new: isActive,
      },
    });

    return product;
  });
}

export async function listProductEditorCategories() {
  return prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}
