import { prisma } from "@kids-store/database";

import { databaseIdSchema } from "../config/validation.js";
import { logger } from "../config/logger.js";

export interface ProductImageDetails {
  url: string;
  sortOrder: number;
}

export interface ProductVariantDetails {
  id: number;
  size: string;
  color: string;
  stock: number;
}

export interface ProductDetails {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  images: ProductImageDetails[];
  variants: ProductVariantDetails[];
}

export interface ActiveProductVariantDetails {
  productId: number;
  productName: string;
  price: number;
  discountPrice: number | null;
  variant: ProductVariantDetails;
}

export interface ActiveProductOptions {
  id: number;
  variants: ProductVariantDetails[];
}

export async function findActiveProductById(
  productIdInput: unknown,
): Promise<ProductDetails | null> {
  const productId = databaseIdSchema.parse(productIdInput);

  try {
    return await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        images: {
          select: {
            url: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        variants: {
          select: {
            id: true,
            size: true,
            color: true,
            stock: true,
          },
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });
  } catch (error) {
    logger.error("Mahsulotni bazadan olishda xato yuz berdi", error, {
      productId,
    });
    throw new Error("Mahsulot ma’lumotlarini olish imkoni bo‘lmadi", {
      cause: error,
    });
  }
}

export async function findActiveProductOptionsById(
  productIdInput: unknown,
): Promise<ActiveProductOptions | null> {
  const productId = databaseIdSchema.parse(productIdInput);

  try {
    return await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      select: {
        id: true,
        variants: {
          where: {
            stock: {
              gt: 0,
            },
          },
          select: {
            id: true,
            size: true,
            color: true,
            stock: true,
          },
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });
  } catch (error) {
    logger.error("Mahsulot variantlarini olishda xato yuz berdi", error, {
      productId,
    });
    throw new Error("Mahsulot variantlarini olish imkoni bo‘lmadi", {
      cause: error,
    });
  }
}

export async function findActiveProductVariant(
  productIdInput: unknown,
  variantIdInput: unknown,
): Promise<ActiveProductVariantDetails | null> {
  const productId = databaseIdSchema.parse(productIdInput);
  const variantId = databaseIdSchema.parse(variantIdInput);

  try {
    const result = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        stock: {
          gt: 0,
        },
        product: {
          isActive: true,
        },
      },
      select: {
        id: true,
        size: true,
        color: true,
        stock: true,
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            discountPrice: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    return {
      productId: result.product.id,
      productName: result.product.name,
      price: result.product.price,
      discountPrice: result.product.discountPrice,
      variant: {
        id: result.id,
        size: result.size,
        color: result.color,
        stock: result.stock,
      },
    };
  } catch (error) {
    logger.error("Mahsulot variantini olishda xato yuz berdi", error, {
      productId,
      variantId,
    });
    throw new Error("Mahsulot variantini olish imkoni bo‘lmadi", {
      cause: error,
    });
  }
}
