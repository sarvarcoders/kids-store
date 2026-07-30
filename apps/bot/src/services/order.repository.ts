import { prisma } from "@kids-store/database";
import type { CreateOrderInput } from "@kids-store/shared";

export interface OrderVariantRecord {
  id: number;
  size: string;
  color: string;
  stock: number;
  product: {
    id: number;
    name: string;
    price: number;
    discountPrice: number | null;
    isActive: boolean;
  };
}

export interface CreatedOrder {
  id: number;
  status: string;
  totalAmount: number;
  deliveryAddress: string;
  customer: {
    telegramUserId: bigint;
    username: string | null;
    firstName: string;
    phone: string | null;
  };
  item: {
    quantity: number;
    unitPrice: number;
    productVariantId: number;
    size: string;
    color: string;
    productId: number;
    productName: string;
  };
}

export interface CreateOrderRecordInput {
  customerId: number;
  productVariantId: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  deliveryAddress: string;
  idempotencyKey: string;
}

export interface OrderTransaction {
  findVariant(productVariantId: number): Promise<OrderVariantRecord | null>;
  reserveStock(productVariantId: number, quantity: number): Promise<boolean>;
  upsertCustomer(customer: CreateOrderInput["customer"]): Promise<number>;
  createOrder(input: CreateOrderRecordInput): Promise<CreatedOrder>;
}

export interface OrderRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<CreatedOrder | null>;
  runInTransaction<T>(
    operation: (transaction: OrderTransaction) => Promise<T>,
  ): Promise<T>;
}

interface PersistedOrder {
  id: number;
  status: string;
  totalAmount: number;
  deliveryAddress: string | null;
  customer: {
    telegramUserId: bigint;
    username: string | null;
    firstName: string;
    phone: string | null;
  };
  items: {
    quantity: number;
    unitPrice: number;
    productVariantId: number;
    productVariant: {
      size: string;
      color: string;
      product: {
        id: number;
        name: string;
      };
    };
  }[];
}

const createdOrderSelect = {
  id: true,
  status: true,
  totalAmount: true,
  deliveryAddress: true,
  customer: {
    select: {
      telegramUserId: true,
      username: true,
      firstName: true,
      phone: true,
    },
  },
  items: {
    select: {
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
  },
} as const;

function mapCreatedOrder(order: PersistedOrder): CreatedOrder {
  const item = order.items[0];

  if (!item || order.deliveryAddress === null) {
    throw new Error("Yaratilgan buyurtma ma’lumotlari to‘liq emas");
  }

  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    deliveryAddress: order.deliveryAddress,
    customer: order.customer,
    item: {
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productVariantId: item.productVariantId,
      size: item.productVariant.size,
      color: item.productVariant.color,
      productId: item.productVariant.product.id,
      productName: item.productVariant.product.name,
    },
  };
}

export class PrismaOrderRepository implements OrderRepository {
  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CreatedOrder | null> {
    const order = await prisma.order.findUnique({
      where: {
        idempotencyKey,
      },
      select: createdOrderSelect,
    });

    return order ? mapCreatedOrder(order) : null;
  }

  async runInTransaction<T>(
    operation: (transaction: OrderTransaction) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(
      async (databaseTransaction) =>
        operation({
          async findVariant(productVariantId) {
            return databaseTransaction.productVariant.findUnique({
              where: {
                id: productVariantId,
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
                    isActive: true,
                  },
                },
              },
            });
          },
          async reserveStock(productVariantId, quantity) {
            const result = await databaseTransaction.productVariant.updateMany({
              where: {
                id: productVariantId,
                stock: {
                  gte: quantity,
                },
                product: {
                  isActive: true,
                },
              },
              data: {
                stock: {
                  decrement: quantity,
                },
              },
            });

            return result.count === 1;
          },
          async upsertCustomer(customer) {
            const usernameData =
              customer.username === undefined
                ? {}
                : { username: customer.username };
            const savedCustomer = await databaseTransaction.customer.upsert({
              where: {
                telegramUserId: customer.telegramUserId,
              },
              create: {
                telegramUserId: customer.telegramUserId,
                firstName: customer.firstName,
                phone: customer.phone,
                ...usernameData,
              },
              update: {
                firstName: customer.firstName,
                phone: customer.phone,
                ...usernameData,
              },
              select: {
                id: true,
              },
            });

            return savedCustomer.id;
          },
          async createOrder(input) {
            const order = await databaseTransaction.order.create({
              data: {
                status: "PENDING",
                totalAmount: input.totalAmount,
                deliveryAddress: input.deliveryAddress,
                idempotencyKey: input.idempotencyKey,
                customerId: input.customerId,
                items: {
                  create: {
                    quantity: input.quantity,
                    unitPrice: input.unitPrice,
                    productVariantId: input.productVariantId,
                  },
                },
              },
              select: createdOrderSelect,
            });

            return mapCreatedOrder(order);
          },
        }),
      {
        maxWait: 5_000,
        timeout: 10_000,
      },
    );
  }
}
