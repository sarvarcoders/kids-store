import { z } from "zod";

import { formatPrice } from "./product-presentation.service.js";

const textSchema = z.string().trim().min(1);

export interface OrderConfirmationMessageInput {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  phone: string;
  deliveryAddress: string;
}

export interface CreatedOrderMessageInput
  extends OrderConfirmationMessageInput {
  orderId: number;
  status: string;
  totalAmount: number;
  telegramUserId: bigint;
  username?: string | undefined;
}

function singleLine(valueInput: unknown): string {
  const value = textSchema.parse(valueInput);
  const withoutControlCharacters = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);

    return codePoint !== undefined &&
      ((codePoint >= 0 && codePoint <= 31) ||
        (codePoint >= 127 && codePoint <= 159))
      ? " "
      : character;
  }).join("");

  return withoutControlCharacters
    .replace(/\s+/g, " ")
    .trim();
}

export function formatOrderStatus(statusInput: unknown): string {
  const status = textSchema.parse(statusInput);
  const labels: Readonly<Record<string, string>> = {
    PENDING: "Kutilmoqda",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyorlanmoqda",
    SHIPPED: "Yetkazilmoqda",
    DELIVERED: "Yetkazib berilgan",
    CANCELLED: "Bekor qilingan",
  };

  return labels[status] ?? singleLine(status);
}

export function formatOrderConfirmation(
  input: OrderConfirmationMessageInput,
): string {
  const totalAmount = input.unitPrice * input.quantity;

  return [
    "🧾 Buyurtmani tekshiring",
    "",
    `Mahsulot: ${singleLine(input.productName)}`,
    `O‘lcham: ${singleLine(input.size)}`,
    `Rang: ${singleLine(input.color)}`,
    `Miqdor: ${String(input.quantity)} dona`,
    `Dona narxi: ${formatPrice(input.unitPrice)}`,
    `Jami: ${formatPrice(totalAmount)}`,
    `Telefon: ${singleLine(input.phone)}`,
    `Manzil: ${singleLine(input.deliveryAddress)}`,
  ].join("\n");
}

export function formatCustomerOrderCreated(
  input: CreatedOrderMessageInput,
): string {
  return [
    "✅ Buyurtmangiz qabul qilindi.",
    "",
    `Buyurtma ID: ${String(input.orderId)}`,
    `Mahsulot: ${singleLine(input.productName)}`,
    `Miqdor: ${String(input.quantity)} dona`,
    `Jami: ${formatPrice(input.totalAmount)}`,
    `Status: ${formatOrderStatus(input.status)}`,
  ].join("\n");
}

export function formatAdminOrderCreated(
  input: CreatedOrderMessageInput,
): string {
  const customer =
    input.username && input.username.trim().length > 0
      ? `@${singleLine(input.username)}`
      : String(input.telegramUserId);

  return [
    "🆕 Yangi buyurtma",
    "",
    `Buyurtma ID: ${String(input.orderId)}`,
    `Mijoz: ${customer}`,
    `Telefon: ${singleLine(input.phone)}`,
    `Manzil: ${singleLine(input.deliveryAddress)}`,
    `Mahsulot: ${singleLine(input.productName)}`,
    `Variant: ${singleLine(input.size)} / ${singleLine(input.color)}`,
    `Miqdor: ${String(input.quantity)} dona`,
    `Jami: ${formatPrice(input.totalAmount)}`,
    `Status: ${formatOrderStatus(input.status)}`,
  ].join("\n");
}
