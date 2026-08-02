import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

const orderStatusTransitions: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrderStatus(
  currentInput: unknown,
  nextInput: unknown,
): boolean {
  const current = orderStatusSchema.safeParse(currentInput);
  const next = orderStatusSchema.safeParse(nextInput);

  return (
    current.success &&
    next.success &&
    (current.data === next.data ||
      orderStatusTransitions[current.data].includes(next.data))
  );
}

export function shouldRestoreStock(
  currentInput: unknown,
  nextInput: unknown,
): boolean {
  const current = orderStatusSchema.safeParse(currentInput);
  const next = orderStatusSchema.safeParse(nextInput);

  return (
    current.success &&
    next.success &&
    next.data === "CANCELLED" &&
    (current.data === "PENDING" || current.data === "CONFIRMED")
  );
}

export function getAllowedOrderStatuses(
  currentInput: unknown,
): OrderStatus[] {
  const current = orderStatusSchema.parse(currentInput);

  return [current, ...orderStatusTransitions[current]];
}
