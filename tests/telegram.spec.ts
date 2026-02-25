import { test, expect } from "@playwright/test";
import { Bot } from "grammy";
import { createBot } from "../packages/integration-telegram/bot.ts";

test.describe.configure({ mode: "serial" });

const CHAT_ID = -5_110_042_075;

const REQUIRED_ENV = ["TELEGRAM_BOT_TOKEN_MAIN", "TELEGRAM_BOT_TOKEN_FRIEND"] as const;

async function waitForBotReply(
  testBot: Bot,
  chatId: number,
  mainBotId: number,
  offset: number,
  timeoutMs: number,
): Promise<{ text: string; newOffset: number }> {
  const deadline = Date.now() + timeoutMs;
  let currentOffset = offset;

  while (Date.now() < deadline) {
    const remaining = Math.max(1, Math.floor((deadline - Date.now()) / 1000));
    const updates = await testBot.api.getUpdates({
      offset: currentOffset,
      timeout: Math.min(10, remaining),
      allowed_updates: ["message"],
    });

    for (const update of updates) {
      currentOffset = update.update_id + 1;
      const message = update.message;
      if (
        message?.chat.id === chatId &&
        message.from.id === mainBotId &&
        message.text !== undefined
      ) {
        return { text: message.text, newOffset: currentOffset };
      }
    }

    if (updates.length === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  }

  throw new Error(`No reply from main bot within ${String(timeoutMs)}ms`);
}

test.describe("Telegram bot", () => {
  const missingEnvironment = REQUIRED_ENV.filter((key) => !process.env[key]);

  let mainBot!: Bot;
  let testBot!: Bot;
  let mainBotId!: number;
  let updateOffset = 0;

  test.beforeAll(async () => {
    test.setTimeout(30_000);
    test.skip(missingEnvironment.length > 0, `Missing env vars: ${missingEnvironment.join(", ")}`);

    const mainToken = process.env["TELEGRAM_BOT_TOKEN_MAIN"];
    const friendToken = process.env["TELEGRAM_BOT_TOKEN_FRIEND"];
    if (!mainToken || !friendToken) return;

    mainBotId = Number(mainToken.split(":").at(0));

    mainBot = createBot(mainToken);
    void mainBot.start();

    testBot = new Bot(friendToken);
    await testBot.init();

    // Drain stale updates so we don't pick up messages from previous test runs
    const stale = await testBot.api.getUpdates({
      timeout: 0,
      allowed_updates: ["message"],
    });
    for (const u of stale) {
      const candidateOffset = u.update_id + 1;
      if (candidateOffset > updateOffset) {
        updateOffset = candidateOffset;
      }
    }
    if (updateOffset > 0) {
      await testBot.api.getUpdates({ offset: updateOffset, timeout: 0 });
    }

    // Give the main bot a moment to establish its long-poll connection
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    });
  });

  test.afterAll(async () => {
    if (missingEnvironment.length > 0) return;
    await mainBot.stop();
  });

  test("replies to /start command", async () => {
    test.setTimeout(30_000);

    await testBot.api.sendMessage(CHAT_ID, "/start");
    const { text, newOffset } = await waitForBotReply(
      testBot,
      CHAT_ID,
      mainBotId,
      updateOffset,
      20_000,
    );
    updateOffset = newOffset;

    expect(text).toMatch(/hello|work in progress/i);
  });

  test("replies to a plain text message with 'Work in progress'", async () => {
    test.setTimeout(30_000);

    await testBot.api.sendMessage(CHAT_ID, "What is 2 + 2?");
    const { text, newOffset } = await waitForBotReply(
      testBot,
      CHAT_ID,
      mainBotId,
      updateOffset,
      20_000,
    );
    updateOffset = newOffset;

    expect(text).toBe("Work in progress.");
  });
});
