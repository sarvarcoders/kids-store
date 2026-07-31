const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  PROCESSING: "Tayyorlanmoqda",
  SHIPPED: "Yetkazilmoqda",
  DELIVERED: "Yetkazib berilgan",
  CANCELLED: "Bekor qilingan",
};

export function formatMiniAppOrderStatus(status: string): string {
  const normalized = status.trim().slice(0, 50);

  return ORDER_STATUS_LABELS[normalized] ?? "Noma’lum holat";
}
