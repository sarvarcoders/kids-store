import { InlineKeyboard } from "grammy";

import {
  adminStatisticsPeriodSchema,
  createAdminStatisticsCallbackData,
} from "../config/admin-statistics.js";

export function createAdminStatisticsKeyboard(
  currentPeriodInput: unknown,
): InlineKeyboard {
  const currentPeriod = adminStatisticsPeriodSchema.parse(
    currentPeriodInput,
  );
  const label = (period: "today" | "7d" | "30d", text: string) =>
    currentPeriod === period ? `• ${text}` : text;

  return new InlineKeyboard()
    .text(label("today", "Bugun"), createAdminStatisticsCallbackData("today"))
    .text(label("7d", "7 kun"), createAdminStatisticsCallbackData("7d"))
    .text(label("30d", "30 kun"), createAdminStatisticsCallbackData("30d"))
    .row()
    .text(
      "🔄 Yangilash",
      createAdminStatisticsCallbackData(currentPeriod),
    );
}
