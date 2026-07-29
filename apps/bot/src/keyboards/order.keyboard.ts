import { InlineKeyboard, Keyboard } from "grammy";

export const CANCEL_ORDER_TEXT = "❌ Bekor qilish";

export function createQuantityKeyboard(
  productVariantId: number,
  availableStock: number,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const maximumQuantity = Math.min(5, availableStock);

  for (let quantity = 1; quantity <= maximumQuantity; quantity += 1) {
    keyboard.text(
      String(quantity),
      `order:quantity:${String(productVariantId)}:${String(quantity)}`,
    );
  }

  return keyboard
    .row()
    .text(CANCEL_ORDER_TEXT, "order:abort");
}

export function createContactKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("📱 Kontaktni yuborish")
    .row()
    .text(CANCEL_ORDER_TEXT)
    .resized()
    .oneTime();
}

export function createOrderConfirmationKeyboard(
  confirmationToken: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      "✅ Buyurtmani tasdiqlash",
      `order:confirm:${confirmationToken}`,
    )
    .row()
    .text("❌ Bekor qilish", `order:cancel:${confirmationToken}`);
}
