import { InlineKeyboard } from "grammy";

import { adminAppUrlSchema } from "../config/admin-launcher.js";

export function createAdminLauncherKeyboard(
  adminAppUrl: string,
): InlineKeyboard {
  const validatedUrl = adminAppUrlSchema.parse(adminAppUrl);

  return new InlineKeyboard().webApp("⚙️ Admin panel", validatedUrl);
}
