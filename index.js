const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.log("❌ BOT_TOKEN غير موجود");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 أهلاً بيك في بوت Gojo Esultan\n\nالبوت شغال بنجاح ✅"
  );
});

bot.on("polling_error", (error) => {
  console.log("Telegram Error:", error.message);
});

console.log("🤖 Gojo Esultan Bot is running...");
