import {
  adminOrderStatusSchema,
  type AdminOrderStatus,
} from "@kids-store/shared";

const transitions: Readonly<
  Record<AdminOrderStatus, readonly AdminOrderStatus[]>
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
  const current = adminOrderStatusSchema.safeParse(currentInput);
  const next = adminOrderStatusSchema.safeParse(nextInput);

  return (
    current.success &&
    next.success &&
    (current.data === next.data ||
      transitions[current.data].includes(next.data))
  );
}

export function shouldRestoreStock(
  currentInput: unknown,
  nextInput: unknown,
): boolean {
  const current = adminOrderStatusSchema.safeParse(currentInput);
  const next = adminOrderStatusSchema.safeParse(nextInput);

  return (
    current.success &&
    next.success &&
    next.data === "CANCELLED" &&
    (current.data === "PENDING" || current.data === "CONFIRMED")
  );
}

export function getAllowedOrderStatuses(
  currentInput: unknown,
): AdminOrderStatus[] {
  const current = adminOrderStatusSchema.parse(currentInput);

  return [current, ...transitions[current]];
}
