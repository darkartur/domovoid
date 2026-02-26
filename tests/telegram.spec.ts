import { test, expect } from "@playwright/test";
// telegram-test-api is a CJS package (module.exports = TelegramServer), but its d.ts uses
// "export default" instead of "export =" — TypeScript NodeNext resolution sees the default
// import as the module namespace (no construct signatures). The cast is safe: at runtime
// module.exports IS the TelegramServer class with start/stop/config as typed below.
import TelegramServerDefault from "telegram-test-api";
import { createBot } from "../packages/integration-telegram/bot.ts";

interface TelegramServerInstance {
  start: () => Promise<void>;
  stop: () => Promise<boolean>;
  config: { apiURL: string };
}

const TelegramServer = TelegramServerDefault as unknown as new (config: {
  port: number;
  storage: string;
  storeTimeout: number;
}) => TelegramServerInstance;

test.describe.configure({ mode: "serial" });

const TOKEN = "123456:fake-token-for-testing";
const CHAT_ID = -1001;

let server: TelegramServerInstance;
let mainBot: ReturnType<typeof createBot>;
const replies: { chatId: number; text: string }[] = [];

test.beforeAll(async () => {
  server = new TelegramServer({ port: 9001, storage: "RAM", storeTimeout: 60 });
  await server.start();

  mainBot = createBot(
    TOKEN,
    (chatId, text) => {
      replies.push({ chatId, text });
    },
    server.config.apiURL,
  );

  // telegram-test-api's getMe response is missing is_bot:true — patch it so grammy's
  // init doesn't reject the bot identity
  mainBot.api.config.use(async (previous, method, payload, signal) => {
    const result = await previous(method, payload, signal);
    if (method === "getMe" && result.ok) {
      (result.result as unknown as Record<string, unknown>)["is_bot"] = true;
    }
    return result;
  });

  await mainBot.init();
});

test.afterAll(async () => {
  await server.stop();
});

test("replies to /start command", async () => {
  await mainBot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: "group", title: "Test" },
      from: { id: 42, is_bot: false, first_name: "Alice" },
      text: "/start",
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  } as Parameters<typeof mainBot.handleUpdate>[0]);

  const reply = replies.find((r) => r.chatId === CHAT_ID);
  expect(reply?.text).toMatch(/hello|work in progress/i);
  replies.length = 0;
});

test("replies to plain text with 'Work in progress'", async () => {
  await mainBot.handleUpdate({
    update_id: 2,
    message: {
      message_id: 2,
      date: Math.floor(Date.now() / 1000),
      chat: { id: CHAT_ID, type: "group", title: "Test" },
      from: { id: 42, is_bot: false, first_name: "Alice" },
      text: "What is 2 + 2?",
    },
  } as Parameters<typeof mainBot.handleUpdate>[0]);

  const reply = replies.find((r) => r.chatId === CHAT_ID);
  expect(reply?.text).toBe("Work in progress.");
  replies.length = 0;
});
