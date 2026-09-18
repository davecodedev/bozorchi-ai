import "dotenv/config";
import { createBot } from "./bot.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MINIAPP_URL = process.env.MINIAPP_URL;

if (!BOT_TOKEN || BOT_TOKEN.includes("FAKE")) {
  console.error("BOT_TOKEN is missing or still the placeholder. Put the real token in bot/.env (never commit it).");
  process.exit(1);
}

// Telegram only accepts HTTPS URLs for web_app buttons; skip the button otherwise.
const miniAppUrl = MINIAPP_URL?.startsWith("https://") ? MINIAPP_URL : undefined;
if (!miniAppUrl) console.warn("MINIAPP_URL is not an https:// URL — Mini App button disabled.");

const bot = createBot({ token: BOT_TOKEN, backendUrl: BACKEND_URL, miniAppUrl });

bot.api
  .setMyCommands([
    { command: "start", description: "Bozorchi AI — start" },
    { command: "help", description: "How to use" },
  ])
  .catch(() => {});

console.log(`bot: starting (backend ${BACKEND_URL}, mini app ${miniAppUrl ? "on" : "off"})`);
bot.start({
  onStart: (me) => console.log(`bot: @${me.username} is polling`),
});
