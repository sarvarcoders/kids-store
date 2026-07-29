import { InlineKeyboard } from "grammy";

export const MENU_CALLBACKS = {
  main: "menu:main",
  catalog: "menu:catalog",
  help: "menu:help",
} as const;

export function createMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🛍 Katalog", MENU_CALLBACKS.catalog)
    .row()
    .text("ℹ️ Yordam", MENU_CALLBACKS.help);
}
