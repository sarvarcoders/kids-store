import { z } from "zod";

const telegramUserIdSchema = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger);
const allowedAdminIdsSchema = z
  .array(z.string().regex(/^[1-9]\d*$/))
  .min(1);

export const adminAppUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .pipe(z.url())
  .refine((value) => new URL(value).protocol === "https:", {
    message: "ADMIN_APP_URL HTTPS URL bo‘lishi kerak",
  });

export const adminLauncherOptionsSchema = z.object({
  adminAppUrl: adminAppUrlSchema,
  allowedAdminIds: allowedAdminIdsSchema,
});

export type AdminLauncherOptions = z.infer<
  typeof adminLauncherOptionsSchema
>;

export function isAdminTelegramUser(
  userId: unknown,
  allowedAdminIds: readonly string[],
): boolean {
  const parsedUserId = telegramUserIdSchema.safeParse(userId);
  const parsedAllowedAdminIds =
    allowedAdminIdsSchema.safeParse(allowedAdminIds);

  return (
    parsedUserId.success &&
    parsedAllowedAdminIds.success &&
    parsedAllowedAdminIds.data.includes(String(parsedUserId.data))
  );
}
