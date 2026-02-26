import { Bot } from "grammy";

export function createBot(
  token: string,
  onReply?: (chatId: number, text: string) => void,
  apiRoot?: string,
): Bot {
  const bot = new Bot(token, apiRoot ? { client: { apiRoot } } : undefined);

  bot.command("start", async (context) => {
    const text = "Hello! I'm here. Work in progress.";
    await context.reply(text);
    onReply?.(context.chat.id, text);
  });

  bot.on("message:text", async (context) => {
    if (context.message.text.startsWith("/")) return;
    const text = "Work in progress.";
    await context.reply(text);
    onReply?.(context.chat.id, text);
  });

  bot.catch((error) => {
    console.error("Bot error:", error);
  });

  return bot;
}
