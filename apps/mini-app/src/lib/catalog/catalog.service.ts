import "server-only";

import { prisma, type Prisma } from "@kids-store/database";
import {
  categoryDtoSchema,
  type CatalogProductDto,
  type CategoryDto,
  type ProductDetailDto,
  type ProductListItemDto,
  type ProductQuery,
} from "@kids-store/shared";
import { z } from "zod";

import {
  formatCatalogProduct,
  formatProductDetail,
  formatProductListItem,
} from "./product-dto";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
} as const;

const imageSelect = {
  id: true,
  url: true,
  sortOrder: true,
} as const;

const variantSelect = {
  id: true,
  size: true,
  color: true,
  stock: true,
} as const;

const catalogCardSelect = {
  id: true,
  name: true,
  price: true,
  discountPrice: true,
  category: {
    select: {
      name: true,
    },
  },
  images: {
    select: {
      url: true,
    },
    orderBy: {
      sortOrder: "asc" as const,
    },
    take: 1,
  },
  variants: {
    where: {
      stock: {
        gt: 0,
      },
    },
    select: {
      size: true,
      stock: true,
    },
    orderBy: {
      size: "asc" as const,
    },
  },
} as const;

const catalogLimitSchema = z.number().int().min(1).max(24);

export interface ProductPage {
  data: ProductListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface CatalogProductPage {
  data: CatalogProductDto[];
  pagination: ProductPage["pagination"];
}

function createCatalogProductWhere(
  query: ProductQuery,
): Prisma.ProductWhereInput {
  return {
    isActive: true,
    variants: {
      some: {
        stock: {
          gt: 0,
        },
      },
    },
    ...(query.category === undefined
      ? {}
      : {
          category: {
            slug: query.category,
          },
        }),
    ...(query.discountOnly
      ? {
          discountPrice: {
            not: null,
          },
        }
      : {}),
    ...(query.search === undefined
      ? {}
      : {
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              code: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }),
  };
}

function createPagination(
  query: ProductQuery,
  total: number,
): ProductPage["pagination"] {
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasPreviousPage: query.page > 1,
    hasNextPage: query.page < totalPages,
  };
}

export async function listCatalogCategories(): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: {
      products: {
        some: {
          isActive: true,
          variants: {
            some: {
              stock: {
                gt: 0,
              },
            },
          },
        },
      },
    },
    select: categorySelect,
    orderBy: {
      name: "asc",
    },
  });

  return categories.map((category) => categoryDtoSchema.parse(category));
}

export async function listCatalogProducts(
  query: ProductQuery,
): Promise<ProductPage> {
  const where = createCatalogProductWhere(query);
  const skip = (query.page - 1) * query.limit;
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        discountPrice: true,
        category: {
          select: categorySelect,
        },
        images: {
          select: imageSelect,
          orderBy: {
            sortOrder: "asc",
          },
          take: 1,
        },
        variants: {
          where: {
            stock: {
              gt: 0,
            },
          },
          select: variantSelect,
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    data: products.map(formatProductListItem),
    pagination: createPagination(query, total),
  };
}

export async function listCatalogProductCards(
  query: ProductQuery,
): Promise<CatalogProductPage> {
  const where = createCatalogProductWhere(query);
  const skip = (query.page - 1) * query.limit;
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: catalogCardSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    data: products.map(formatCatalogProduct),
    pagination: createPagination(query, total),
  };
}

export async function listDiscountCatalogProductCards(
  limitInput: unknown,
): Promise<CatalogProductDto[]> {
  const limit = catalogLimitSchema.parse(limitInput);
  const where = createCatalogProductWhere({
    discountOnly: true,
    page: 1,
    limit,
  });
  const products = await prisma.product.findMany({
    where,
    select: catalogCardSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  return products.map(formatCatalogProduct);
}

export async function getCatalogProductById(
  productId: number,
): Promise<ProductDetailDto | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
      variants: {
        some: {
          stock: {
            gt: 0,
          },
        },
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      price: true,
      discountPrice: true,
      category: {
        select: categorySelect,
      },
      images: {
        select: imageSelect,
        orderBy: {
          sortOrder: "asc",
        },
      },
      variants: {
        where: {
          stock: {
            gt: 0,
          },
        },
        select: variantSelect,
        orderBy: [{ size: "asc" }, { color: "asc" }],
      },
    },
  });

  return product ? formatProductDetail(product) : null;
}
