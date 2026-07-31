import { InlineKeyboard } from "grammy";

import type {
  ProductVariantDetails,
} from "../services/product.service.js";
import { MENU_CALLBACKS } from "./main-menu.keyboard.js";

function addButtons(
  keyboard: InlineKeyboard,
  buttons: readonly { text: string; data: string }[],
  columns: number,
): void {
  buttons.forEach((button, index) => {
    keyboard.text(button.text, button.data);

    const shouldStartNewRow =
      (index + 1) % columns === 0 && index < buttons.length - 1;

    if (shouldStartNewRow) {
      keyboard.row();
    }
  });
}

export interface ProductOptions {
  id: number;
  variants: ProductVariantDetails[];
}

export function createSizeKeyboard(product: ProductOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const variantsBySize = new Map<string, ProductVariantDetails>();

  for (const variant of product.variants) {
    if (variant.stock > 0 && !variantsBySize.has(variant.size)) {
      variantsBySize.set(variant.size, variant);
    }
  }

  const buttons = Array.from(variantsBySize.values()).map((variant) => ({
    text: variant.size,
    data: `size:${String(product.id)}:${String(variant.id)}`,
  }));

  addButtons(keyboard, buttons, 3);

  if (buttons.length > 0) {
    keyboard.row();
  }

  return keyboard.text("🏠 Bosh menyu", MENU_CALLBACKS.main);
}

export function createColorKeyboard(
  product: ProductOptions,
  selectedSize: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const buttons = product.variants
    .filter((variant) => variant.size === selectedSize && variant.stock > 0)
    .map((variant) => ({
      text: variant.color,
      data: `color:${String(product.id)}:${String(variant.id)}`,
    }));

  addButtons(keyboard, buttons, 2);

  if (buttons.length > 0) {
    keyboard.row();
  }

  return keyboard
    .text("⬅️ O‘lchamni almashtirish", `product:${String(product.id)}`)
    .row()
    .text("🏠 Bosh menyu", MENU_CALLBACKS.main);
}
