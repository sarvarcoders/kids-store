import { z } from "zod";

import type { AdminStatisticsPeriod } from "../config/admin-statistics.js";
import type { AdminStatisticsReport } from "./admin-statistics.service.js";

const priceFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tashkent",
});
const reportSchema: z.ZodType<AdminStatisticsReport> = z.object({
  activeProducts: z.number().int().nonnegative(),
  channelPosts: z.number().int().nonnegative(),
  currentPendingOrders: z.number().int().nonnegative(),
  generatedAt: z.date(),
  lowStockVariants: z.number().int().nonnegative(),
  newCustomers: z.number().int().nonnegative(),
  orderValue: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  outOfStockVariants: z.number().int().nonnegative(),
  period: z.enum(["today", "7d", "30d"]),
  rangeStart: z.date(),
  soldUnits: z.number().int().nonnegative(),
  statusCounts: z.array(
    z.object({
      count: z.number().int().nonnegative(),
      status: z.enum([
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ]),
    }),
  ),
  topVariants: z.array(
    z.object({
      color: z.string().trim().min(1).max(80),
      productName: z.string().trim().min(1).max(160),
      quantity: z.number().int().positive(),
      size: z.string().trim().min(1).max(50),
    }),
  ),
});

const periodLabels: Record<AdminStatisticsPeriod, string> = {
  today: "Bugun",
  "7d": "Oxirgi 7 kun",
  "30d": "Oxirgi 30 kun",
};

function formatPrice(value: number): string {
  return `${priceFormatter.format(value)} so‘m`;
}

function getStatusCount(
  report: AdminStatisticsReport,
  status: AdminStatisticsReport["statusCounts"][number]["status"],
): number {
  return (
    report.statusCounts.find((item) => item.status === status)?.count ?? 0
  );
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function formatAdminStatistics(
  reportInput: unknown,
): string {
  const report = reportSchema.parse(reportInput);
  const lines = [
    "📊 Do‘kon statistikasi",
    `📅 Davr: ${periodLabels[report.period]}`,
    `🕒 Yangilandi: ${dateTimeFormatter.format(report.generatedAt)}`,
    "",
    "💰 Buyurtmalar",
    `• Jami: ${String(report.orders)} ta`,
    `• Bekor qilinmagan qiymati: ${formatPrice(report.orderValue)}`,
    `• Sotilgan birliklar: ${String(report.soldUnits)} dona`,
    `• Kutilmoqda: ${String(getStatusCount(report, "PENDING"))}`,
    `• Tasdiqlangan: ${String(getStatusCount(report, "CONFIRMED"))}`,
    `• Tayyor: ${String(getStatusCount(report, "PROCESSING"))}`,
    `• Yetkazilmoqda: ${String(getStatusCount(report, "SHIPPED"))}`,
    `• Yetkazilgan: ${String(getStatusCount(report, "DELIVERED"))}`,
    `• Bekor qilingan: ${String(getStatusCount(report, "CANCELLED"))}`,
    `• Hozirgi faol zakazlar: ${String(report.currentPendingOrders)} ta`,
    "",
    "👥 Auditoriya",
    `• Yangi mijozlar: ${String(report.newCustomers)} ta`,
    `• Kanal postlari: ${String(report.channelPosts)} ta`,
    "",
    "📦 Katalog holati",
    `• Faol mahsulotlar: ${String(report.activeProducts)} ta`,
    `• Kam qolgan variantlar (1–5): ${String(report.lowStockVariants)} ta`,
    `• Stock tugagan variantlar: ${String(report.outOfStockVariants)} ta`,
  ];

  if (report.topVariants.length > 0) {
    lines.push("", "🏆 Eng ko‘p sotilgan variantlar");
    report.topVariants.forEach((variant, index) => {
      lines.push(
        `${String(index + 1)}. ${singleLine(variant.productName)} — ${singleLine(variant.size)} / ${singleLine(variant.color)} · ${String(variant.quantity)} dona`,
      );
    });
  }

  lines.push(
    "",
    "ℹ️ Qiymat bekor qilinmagan buyurtmalar asosida hisoblangan.",
  );

  return lines.join("\n");
}
