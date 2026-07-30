import type { Context, SessionFlavor } from "grammy";

export interface ProductSelection {
  productId: number;
  selectedSize?: string;
  selectedColor?: string;
  productVariantId?: number;
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
  quantity?: number;
  phone?: string;
  deliveryAddress?: string;
  confirmationToken?: string;
  createdOrderId?: number;
}

export interface BotSession {
  productSelection: ProductSelection | null;
  orderDraft: OrderDraft | null;
}

export type BotContext = Context & SessionFlavor<BotSession>;

export function createInitialSession(): BotSession {
  return {
    productSelection: null,
    orderDraft: null,
  };
}
