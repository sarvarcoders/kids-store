import { InlineKeyboard } from "grammy";
import { z } from "zod";

const telegramUrlSchema = z
  .url()
  .refine((value) => value.startsWith("https://t.me/"), {
    message: "Telegram deep link noto‘g‘ri",
  });

export function createChannelPurchaseKeyboard(
  deepLinkInput: unknown,
): InlineKeyboard {
  const deepLink = telegramUrlSchema.parse(deepLinkInput);

  return new InlineKeyboard().url("🛍 Sotib olish", deepLink);
}
