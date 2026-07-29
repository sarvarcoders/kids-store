import type { Context, SessionFlavor } from "grammy";

export interface ProductSelection {
  productId: number;
  selectedSize?: string;
  selectedColor?: string;
  productVariantId?: number;
}

export interface BotSession {
  productSelection: ProductSelection | null;
}

export type BotContext = Context & SessionFlavor<BotSession>;

export function createInitialSession(): BotSession {
  return {
    productSelection: null,
  };
}
