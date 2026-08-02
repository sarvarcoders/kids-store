import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_BOT_COMMANDS,
  DEFAULT_BOT_COMMANDS,
  configureBotCommandMenu,
  type SetBotCommands,
} from "../src/services/bot-command-menu.js";

void test("default va admin Telegram command menyularini o‘rnatadi", async () => {
  const calls: {
    commands: readonly { command: string; description: string }[];
    options: Parameters<SetBotCommands>[1];
  }[] = [];

  await configureBotCommandMenu((commands, options) => {
    calls.push({ commands, options });
    return Promise.resolve();
  }, ["123", "456", "123"]);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], {
    commands: DEFAULT_BOT_COMMANDS,
    options: { scope: { type: "default" } },
  });
  assert.deepEqual(calls[1], {
    commands: ADMIN_BOT_COMMANDS,
    options: { scope: { chat_id: 123, type: "chat" } },
  });
  assert.deepEqual(calls[2], {
    commands: ADMIN_BOT_COMMANDS,
    options: { scope: { chat_id: 456, type: "chat" } },
  });
});

void test("noto‘g‘ri admin Telegram ID bilan API chaqirilmaydi", async () => {
  let callCount = 0;

  await assert.rejects(
    configureBotCommandMenu(() => {
      callCount += 1;
      return Promise.resolve();
    }, ["0"]),
  );
  assert.equal(callCount, 0);
});
