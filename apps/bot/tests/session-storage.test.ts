import assert from "node:assert/strict";
import test from "node:test";

import {
  ResilientBotSessionStorage,
  type SessionStorage,
} from "../src/services/session-storage.js";
import {
  createInitialSession,
  type BotSession,
} from "../src/types/bot-context.js";

class FakeRemoteSessionStorage implements SessionStorage<BotSession> {
  readonly values = new Map<string, BotSession>();
  readCalls = 0;
  writeCalls = 0;

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }

  read(key: string): Promise<BotSession | undefined> {
    this.readCalls += 1;
    return Promise.resolve(this.values.get(key));
  }

  write(key: string, value: BotSession): Promise<void> {
    this.writeCalls += 1;
    this.values.set(key, value);
    return Promise.resolve();
  }
}

void test("issiq bot session takroriy Redis read qilmaydi", async () => {
  const remote = new FakeRemoteSessionStorage();
  const session = createInitialSession();
  remote.values.set("user-1", session);
  const storage = new ResilientBotSessionStorage(remote);

  assert.equal(await storage.read("user-1"), session);
  assert.equal(await storage.read("user-1"), session);
  assert.equal(remote.readCalls, 1);
});

void test("bot session write Redisda saqlanib lokal readni tezlashtiradi", async () => {
  const remote = new FakeRemoteSessionStorage();
  const storage = new ResilientBotSessionStorage(remote);
  const session = createInitialSession();

  await storage.write("user-2", session);
  assert.equal(remote.writeCalls, 1);
  assert.equal(await storage.read("user-2"), session);
  assert.equal(remote.readCalls, 0);
});
