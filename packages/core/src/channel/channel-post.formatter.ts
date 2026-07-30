import { z } from "zod";

export const TELEGRAM_PHOTO_CAPTION_LIMIT = 1_024;
export const TELEGRAM_TEXT_MESSAGE_LIMIT = 4_096;

const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);
const textLimitSchema = z.number().int().positive();
const moneyAmountSchema = z.number().int().nonnegative();
const botUsernameSchema = z
  .string()
  .trim()
  .regex(/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/)
  .transform((value) => value.replace(/^@/, ""));
const channelPostProductSchema = z.object({
  id: databaseIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().nullable(),
  price: moneyAmountSchema,
  discountPrice: moneyAmountSchema.nullable(),
  category: z.object({
    name: z.string().trim().min(1).max(120),
  }),
  variants: z.array(
    z.object({
      size: z.string().trim().min(1).max(50),
      color: z.string().trim().min(1).max(80),
      stock: z.number().int(),
    }),
  ),
});

const priceFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 0,
});

export type ChannelPostProduct = z.infer<typeof channelPostProductSchema>;

export function formatChannelPrice(amountInput: unknown): string {
  const amount = moneyAmountSchema.parse(amountInput);
  const formattedAmount = priceFormatter.format(amount).replace(/\s/g, " ");

  return `${formattedAmount} so‘m`;
}

export function truncateTelegramText(
  textInput: unknown,
  maxLengthInput: unknown,
): string {
  const text = z.string().parse(textInput);
  const maxLength = textLimitSchema.parse(maxLengthInput);

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength === 1) {
    return "…";
  }

  let truncated = text.slice(0, maxLength - 1);
  const finalCodeUnit = truncated.charCodeAt(truncated.length - 1);

  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated.trimEnd()}…`;
}

export function buildProductDeepLink(
  botUsernameInput: unknown,
  productIdInput: unknown,
): string {
  const botUsername = botUsernameSchema.parse(botUsernameInput);
  const productId = databaseIdSchema.parse(productIdInput);

  return `https://t.me/${botUsername}?start=product_${String(productId)}`;
}

function getUniqueInStockValues(
  variants: ChannelPostProduct["variants"],
  field: "size" | "color",
): string[] {
  return Array.from(
    new Set(
      variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => variant[field]),
    ),
  );
}

function formatDiscountPrice(discountPrice: number | null): string {
  return discountPrice === null
    ? "mavjud emas"
    : formatChannelPrice(discountPrice);
}

export function formatChannelPost(
  productInput: unknown,
  maxLengthInput: unknown,
): string {
  const product = channelPostProductSchema.parse(productInput);
  const maxLength = textLimitSchema.parse(maxLengthInput);
  const sizes = getUniqueInStockValues(product.variants, "size");
  const colors = getUniqueInStockValues(product.variants, "color");
  const fixedText = [
    `👕 ${truncateTelegramText(product.name, 140)}`,
    `🏷 Kod: ${truncateTelegramText(product.code, 64)}`,
    `📂 Kategoriya: ${truncateTelegramText(product.category.name, 100)}`,
    "",
    `💵 Eski narxi: ${formatChannelPrice(product.price)}`,
    `🔥 Chegirmali narxi: ${formatDiscountPrice(product.discountPrice)}`,
    `📏 Mavjud o‘lchamlar: ${truncateTelegramText(
      sizes.length > 0 ? sizes.join(", ") : "mavjud emas",
      160,
    )}`,
    `🎨 Mavjud ranglar: ${truncateTelegramText(
      colors.length > 0 ? colors.join(", ") : "mavjud emas",
      160,
    )}`,
    "",
    "🚚 Yetkazib berish: O‘zbekiston bo‘ylab yetkazib berish mavjud.",
  ].join("\n");
  const descriptionPrefix = "\n\n📝 Tavsif: ";
  const description =
    product.description && product.description.length > 0
      ? product.description
      : "Tavsif mavjud emas.";
  const remainingLength =
    maxLength - fixedText.length - descriptionPrefix.length;

  if (remainingLength <= 0) {
    return truncateTelegramText(fixedText, maxLength);
  }

  return `${fixedText}${descriptionPrefix}${truncateTelegramText(
    description,
    remainingLength,
  )}`;
}

export function formatChannelPhotoCaption(productInput: unknown): string {
  return formatChannelPost(productInput, TELEGRAM_PHOTO_CAPTION_LIMIT);
}

export function formatChannelTextPost(productInput: unknown): string {
  return formatChannelPost(productInput, TELEGRAM_TEXT_MESSAGE_LIMIT);
}
