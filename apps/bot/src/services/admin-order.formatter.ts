import { formatOrderStatus, orderStatusSchema } from "@kids-store/shared";
import { z } from "zod";

import {
  adminManagedOrderSchema,
  type AdminManagedOrder,
} from "./admin-order.service.js";
import { formatPrice } from "./product-presentation.service.js";

const tashkentDateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tashkent",
});
const TELEGRAM_SAFE_TEXT_LIMIT = 4_000;

function singleLine(value: string, maximum = 160): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function formatAdminManagedOrder(orderInput: unknown): string {
  const order: AdminManagedOrder =
    adminManagedOrderSchema.parse(orderInput);
  const customerName = order.customer.username
    ? `@${singleLine(order.customer.username, 32)}`
    : singleLine(order.customer.firstName, 120);
  const contactState = order.contactedAt
    ? `✅ Bog‘lanilgan: ${tashkentDateFormatter.format(order.contactedAt)}`
    : "⏳ Mijoz bilan bog‘lanish kutilmoqda";
  const itemLines = order.items.map(
    (item, index) =>
      `${String(index + 1)}. ${singleLine(item.productVariant.product.name)} — ${singleLine(item.productVariant.size, 50)} / ${singleLine(item.productVariant.color, 80)}, ${String(item.quantity)} dona × ${formatPrice(item.unitPrice)}`,
  );

  const message = [
    `📦 Buyurtma #${String(order.id)}`,
    `🕒 ${tashkentDateFormatter.format(order.createdAt)}`,
    "",
    `Status: ${formatOrderStatus(order.status)}`,
    contactState,
    `Mijoz: ${customerName}`,
    `Telefon: ${order.customer.phone ?? "Kiritilmagan"}`,
    `Manzil: ${order.deliveryAddress ? singleLine(order.deliveryAddress, 500) : "Kiritilmagan"}`,
    `Jami: ${formatPrice(order.totalAmount)}`,
    "",
    ...itemLines,
  ].join("\n");

  return message.length <= TELEGRAM_SAFE_TEXT_LIMIT
    ? message
    : `${message.slice(0, TELEGRAM_SAFE_TEXT_LIMIT - 1).trimEnd()}…`;
}

export function formatCustomerOrderProgress(input: {
  orderId: unknown;
  status: unknown;
}): string {
  const parsed = z
    .object({
      orderId: z.number().int().positive(),
      status: orderStatusSchema,
    })
    .parse(input);
  const messages = {
    PENDING: "Buyurtmangiz qabul qilindi. Tez orada do‘kon egasi siz bilan bog‘lanadi.",
    CONFIRMED: "✅ To‘lovingiz tasdiqlandi. Buyurtmangiz tayyorlanishga qabul qilindi.",
    PROCESSING: "📦 Buyurtmangiz tayyor. Tez orada dostavkaga yuboriladi.",
    SHIPPED: "🚚 Buyurtmangiz dostavkaga yuborildi. Iltimos, telefoningiz yoqilgan bo‘lsin.",
    DELIVERED: "🎉 Buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!",
    CANCELLED: "❌ Buyurtmangiz bekor qilindi. Savol bo‘lsa, do‘kon bilan bog‘laning.",
  } as const;

  return [
    messages[parsed.status],
    "",
    `Buyurtma ID: ${String(parsed.orderId)}`,
    `Holat: ${formatOrderStatus(parsed.status)}`,
  ].join("\n");
}
