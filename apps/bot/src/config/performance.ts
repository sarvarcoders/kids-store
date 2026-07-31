import { z } from "zod";

const telegramUserIdSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

export const BOT_RUNNER_CONCURRENCY = 10;
export const BOT_UPDATE_TIMEOUT_MS = 30_000;
export const BOT_ALLOWED_UPDATES = ["message", "callback_query"] as const;

export interface BotIdentityContext {
  from: { id: number } | undefined;
}

export function getBotSessionKey(
  context: BotIdentityContext,
): string | undefined {
  const parsedUserId = telegramUserIdSchema.safeParse(context.from?.id);

  return parsedUserId.success ? String(parsedUserId.data) : undefined;
}
