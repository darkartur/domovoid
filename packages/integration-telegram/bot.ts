import { Bot } from "grammy";

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (context) => {
    await context.reply("Hello! I'm here. Work in progress.");
  });

  bot.on("message:text", async (context) => {
    if (context.message.text.startsWith("/")) return;
    await context.reply("Work in progress.");
  });

  bot.catch((error) => {
    console.error("Bot error:", error);
  });

  return bot;
}
