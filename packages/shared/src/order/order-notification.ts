import { z } from "zod";

const MAX_TELEGRAM_MESSAGE_LENGTH = 4_000;
const notificationItemSchema = z.object({
  productName: z.string().trim().min(1).max(160),
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(5),
  unitPrice: z.number().int().nonnegative(),
});
const notificationSchema = z.object({
  orderId: z.number().int().positive(),
  status: z.string().trim().min(1).max(50),
  totalAmount: z.number().int().nonnegative(),
  phone: z.string().trim().min(1).max(32),
  deliveryAddress: z.string().trim().min(1).max(500),
  telegramUserId: z.string().regex(/^[1-9]\d*$/),
  username: z.string().trim().min(1).max(32).optional(),
  items: z.array(notificationItemSchema).min(1),
});

export type OrderNotificationInput = z.infer<
  typeof notificationSchema
>;

function singleLine(valueInput: unknown): string {
  const value = z.string().trim().min(1).parse(valueInput);
  const withoutControlCharacters = Array.from(
    value,
    (character) => {
      const codePoint = character.codePointAt(0);

      return codePoint !== undefined &&
        ((codePoint >= 0 && codePoint <= 31) ||
          (codePoint >= 127 && codePoint <= 159))
        ? " "
        : character;
    },
  ).join("");

  return withoutControlCharacters.replace(/\s+/g, " ").trim();
}

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so‘m`;
}

function truncateTelegramMessage(message: string): string {
  return message.length <= MAX_TELEGRAM_MESSAGE_LENGTH
    ? message
    : `${message.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH - 1).trimEnd()}…`;
}

export function formatOrderStatus(statusInput: unknown): string {
  const status = z.string().trim().min(1).max(50).parse(statusInput);
  const labels: Readonly<Record<string, string>> = {
    PENDING: "Kutilmoqda",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyor",
    SHIPPED: "Yetkazilmoqda",
    DELIVERED: "Yetkazib berilgan",
    CANCELLED: "Bekor qilingan",
  };

  return labels[status] ?? singleLine(status);
}

function formatItems(
  items: OrderNotificationInput["items"],
): string[] {
  return items.map(
    (item, index) =>
      `${String(index + 1)}. ${singleLine(item.productName)} — ${singleLine(item.size)} / ${singleLine(item.color)}, ${String(item.quantity)} dona × ${formatPrice(item.unitPrice)}`,
  );
}

export function formatCustomerOrderNotification(
  input: unknown,
): string {
  const order = notificationSchema.parse(input);

  return truncateTelegramMessage(
    [
      "✅ Buyurtmangiz qabul qilindi.",
      "",
      `Buyurtma ID: ${String(order.orderId)}`,
      ...formatItems(order.items),
      `Jami: ${formatPrice(order.totalAmount)}`,
      `Telefon: ${singleLine(order.phone)}`,
      `Manzil: ${singleLine(order.deliveryAddress)}`,
      `Status: ${formatOrderStatus(order.status)}`,
    ].join("\n"),
  );
}

export function formatAdminOrderNotification(
  input: unknown,
): string {
  const order = notificationSchema.parse(input);
  const customer = order.username
    ? `@${singleLine(order.username)}`
    : order.telegramUserId;

  return truncateTelegramMessage(
    [
      "🆕 Yangi buyurtma",
      "",
      `Buyurtma ID: ${String(order.orderId)}`,
      `Mijoz: ${customer}`,
      `Telegram ID: ${order.telegramUserId}`,
      `Telefon: ${singleLine(order.phone)}`,
      `Manzil: ${singleLine(order.deliveryAddress)}`,
      ...formatItems(order.items),
      `Jami: ${formatPrice(order.totalAmount)}`,
      `Status: ${formatOrderStatus(order.status)}`,
    ].join("\n"),
  );
}

export function formatCustomerOrderStatusUpdate(input: {
  orderId: unknown;
  status: unknown;
}): string {
  const parsed = z
    .object({
      orderId: z.number().int().positive(),
      status: z.string().trim().min(1).max(50),
    })
    .parse(input);

  return [
    "📦 Buyurtma holati yangilandi.",
    "",
    `Buyurtma ID: ${String(parsed.orderId)}`,
    `Yangi status: ${formatOrderStatus(parsed.status)}`,
  ].join("\n");
}
