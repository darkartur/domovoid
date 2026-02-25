import { Bot } from "grammy";
import Anthropic from "@anthropic-ai/sdk";

export function createBot(token: string, anthropicApiKey: string): Bot {
  const bot = new Bot(token);
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  bot.command("start", async (context) => {
    await context.reply("Hello! I'm powered by Claude. Send me a message.");
  });

  bot.on("message:text", async (context) => {
    if (context.message.text.startsWith("/")) return;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: context.message.text }],
    });

    let replyText = "Sorry, I couldn't generate a response.";
    for (const block of response.content) {
      if (block.type === "text") {
        replyText = block.text;
        break;
      }
    }

    await context.reply(replyText);
  });

  bot.catch((error) => {
    console.error("Bot error:", error);
  });

  return bot;
}
