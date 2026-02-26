import { fileURLToPath } from "node:url";
import { createBot } from "./bot.ts";

export const INTEGRATION_NAME = "telegram";

export function start(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN_MAIN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_MAIN is not set");
  void createBot(token).start();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}

export { createBot } from "./bot.ts";
