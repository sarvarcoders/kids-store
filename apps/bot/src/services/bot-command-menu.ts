import { z } from "zod";

const telegramChatIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger);
const adminTelegramIdsSchema = z
  .array(telegramChatIdSchema)
  .min(1)
  .transform((values) => Array.from(new Set(values)));

interface BotCommandDefinition {
  command: string;
  description: string;
}

interface BotCommandOptions {
  scope:
    | { type: "default" }
    | { chat_id: number; type: "chat" };
}

export type SetBotCommands = (
  commands: readonly BotCommandDefinition[],
  options: BotCommandOptions,
) => Promise<unknown>;

export const DEFAULT_BOT_COMMANDS = [
  { command: "start", description: "Bosh menyuni ochish" },
  { command: "help", description: "Yordam olish" },
  { command: "admin", description: "Admin panelni ochish" },
] as const;

export const ADMIN_BOT_COMMANDS = [
  ...DEFAULT_BOT_COMMANDS,
  { command: "stats", description: "Do‘kon statistikasini ko‘rish" },
  { command: "orders", description: "Faol zakazlarni boshqarish" },
  { command: "publish", description: "Mahsulotni kanalga chiqarish" },
] as const;

export async function configureBotCommandMenu(
  setBotCommands: SetBotCommands,
  adminTelegramIdsInput: unknown,
): Promise<void> {
  const adminTelegramIds = adminTelegramIdsSchema.parse(
    adminTelegramIdsInput,
  );

  await setBotCommands(DEFAULT_BOT_COMMANDS, {
    scope: { type: "default" },
  });
  await Promise.all(
    adminTelegramIds.map((chatId) =>
      setBotCommands(ADMIN_BOT_COMMANDS, {
        scope: { chat_id: chatId, type: "chat" },
      }),
    ),
  );
}
