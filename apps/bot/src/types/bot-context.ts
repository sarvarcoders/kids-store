import type { Context, SessionFlavor } from "grammy";
import { z } from "zod";

export interface ProductSelection {
  productId: number;
  selectedSize?: string | undefined;
  selectedColor?: string | undefined;
  productVariantId?: number | undefined;
}

export type OrderStep =
  | "selecting_quantity"
  | "awaiting_phone"
  | "awaiting_address"
  | "awaiting_confirmation"
  | "submitting"
  | "completed";

export interface OrderDraft {
  productId: number;
  productVariantId: number;
  productName: string;
  selectedSize: string;
  selectedColor: string;
  unitPrice: number;
  availableStock: number;
  step: OrderStep;
  quantity?: number | undefined;
  phone?: string | undefined;
  deliveryAddress?: string | undefined;
  confirmationToken?: string | undefined;
  createdOrderId?: number | undefined;
}

export interface BotSession {
  productSelection: ProductSelection | null;
  orderDraft: OrderDraft | null;
}

const productSelectionSchema = z.object({
  productId: z.number().int().positive(),
  selectedSize: z.string().min(1).max(30).optional(),
  selectedColor: z.string().min(1).max(50).optional(),
  productVariantId: z.number().int().positive().optional(),
});
const orderDraftSchema = z.object({
  productId: z.number().int().positive(),
  productVariantId: z.number().int().positive(),
  productName: z.string().min(1).max(200),
  selectedSize: z.string().min(1).max(30),
  selectedColor: z.string().min(1).max(50),
  unitPrice: z.number().int().nonnegative(),
  availableStock: z.number().int().positive(),
  step: z.enum([
    "selecting_quantity",
    "awaiting_phone",
    "awaiting_address",
    "awaiting_confirmation",
    "submitting",
    "completed",
  ]),
  quantity: z.number().int().min(1).max(5).optional(),
  phone: z.string().min(1).max(30).optional(),
  deliveryAddress: z.string().min(1).max(500).optional(),
  confirmationToken: z.string().min(1).max(200).optional(),
  createdOrderId: z.number().int().positive().optional(),
});

export const botSessionSchema: z.ZodType<BotSession> = z.object({
  productSelection: productSelectionSchema.nullable(),
  orderDraft: orderDraftSchema.nullable(),
});

export type BotContext = Context & SessionFlavor<BotSession>;

export function createInitialSession(): BotSession {
  return {
    productSelection: null,
    orderDraft: null,
  };
}
