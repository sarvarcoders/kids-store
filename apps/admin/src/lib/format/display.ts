export function formatAdminPrice(value: number): string {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so‘m`;
}

export function formatAdminDate(value: string | Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatAdminOrderStatus(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    PENDING: "Yangi",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyorlanmoqda",
    SHIPPED: "Jo‘natilgan",
    DELIVERED: "Yetkazilgan",
    CANCELLED: "Bekor qilingan",
  };

  return labels[value] ?? value;
}
