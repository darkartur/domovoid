import { fileURLToPath } from "node:url";
import { createBot } from "./bot.ts";

export const INTEGRATION_NAME = "telegram";

export function start(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  void createBot(token, apiKey).start();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}

export { createBot } from "./bot.ts";
