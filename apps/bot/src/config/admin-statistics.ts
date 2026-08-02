import { z } from "zod";

export const adminStatisticsPeriodSchema = z.enum([
  "today",
  "7d",
  "30d",
]);

const adminStatisticsCallbackSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^admin_stats:(today|7d|30d)$/)
  .transform((value) =>
    adminStatisticsPeriodSchema.parse(value.split(":")[1]),
  );

export type AdminStatisticsPeriod = z.infer<
  typeof adminStatisticsPeriodSchema
>;

export function createAdminStatisticsCallbackData(
  periodInput: unknown,
): string {
  const period = adminStatisticsPeriodSchema.parse(periodInput);

  return `admin_stats:${period}`;
}

export function parseAdminStatisticsCallbackData(
  valueInput: unknown,
): AdminStatisticsPeriod {
  return adminStatisticsCallbackSchema.parse(valueInput);
}
