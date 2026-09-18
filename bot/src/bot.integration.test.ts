/**
 * Drives the bot with fake Telegram updates against the REAL backend — no bot token needed.
 * Skips itself when the backend isn't reachable (set BACKEND_URL, default localhost:3000).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "./bot.ts";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const backendUp = await fetch(`${BACKEND_URL}/health`).then((r) => r.ok).catch(() => false);

type Sent = { method: string; payload: Record<string, unknown> };

function harness() {
  const sent: Sent[] = [];
  const bot = createBot({
    token: "000:fake",
    backendUrl: BACKEND_URL,
    miniAppUrl: "https://bazarcha.example/miniapp",
  });
  // Intercept every Bot API call instead of hitting Telegram.
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "Bozorchi AI", username: "bazarcha_test_bot",
    can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: true, has_topics_enabled: false,
  } as never;
  return { bot, sent };
}

let updateId = 1;
const user = (lang = "uz") => ({ id: 42, is_bot: false, first_name: "Test", language_code: lang });
const chat = { id: 42, type: "private" as const };
const textUpdate = (text: string, lang?: string) => ({
  update_id: updateId++,
  message: { message_id: updateId, date: 0, chat, from: user(lang), text },
});
const messages = (sent: Sent[]) => sent.filter((s) => s.method === "sendMessage");

test("/start replies with welcome + quick-pick keyboard", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate({
    ...textUpdate("/start"),
    message: { ...textUpdate("/start").message, entities: [{ type: "bot_command", offset: 0, length: 6 }] },
  } as never);
  const [m] = messages(sent);
  assert.match(String(m.payload.text), /Bozorchi AI/);
  const kb = (m.payload.reply_markup as { keyboard: { text: string }[][] }).keyboard;
  assert.equal(kb[0].length, 3);
  assert.match(kb[0][0].text, /Pomidor/);
});

test("'pomidor Chilonzor' → 3 ranked sellers with Mini App button", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate(textUpdate("pomidor Chilonzor") as never);
  const [m] = messages(sent);
  const text = String(m.payload.text);
  assert.match(text, /<b>Pomidor<\/b> — \d+ ta taklifdan/);
  assert.match(text, /📍 Chilanzar/);
  assert.equal((text.match(/🥇|🥈|🥉/g) ?? []).length, 3);
  assert.match(text, /AI tanlovi/);
  const btn = (m.payload.reply_markup as { inline_keyboard: { text: string; web_app: { url: string } }[][] })
    .inline_keyboard[0][0];
  assert.match(btn.text, /Mini App/);
  assert.equal(btn.web_app.url, "https://bazarcha.example/miniapp?product=tomato&region=Chilanzar");
});

test("quick-pick button '🥔 Картошка' in Russian → potato results in Russian", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate(textUpdate("🥔 Картошка", "ru") as never);
  const text = String(messages(sent)[0].payload.text);
  assert.match(text, /<b>Помидор|<b>Картофель<\/b> — топ-3/);
  assert.match(text, /сум\/кг/);
});

test("shared location is used for the next query", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: 1, date: 0, chat, from: user(), location: { latitude: 41.25, longitude: 69.36 } },
  } as never);
  assert.match(String(messages(sent)[0].payload.text), /saqlandi/);
  await bot.handleUpdate(textUpdate("piyoz") as never);
  const text = String(messages(sent)[1].payload.text);
  assert.match(text, /📍 Sizga yaqin/);
  assert.match(text, /🥇 <b>Qo&#39;yliq Ulgurji<\/b>|🥇 <b>Qo'yliq Ulgurji<\/b>/); // nearest wholesaler wins
  const url = (messages(sent)[1].payload.reply_markup as { inline_keyboard: { web_app: { url: string } }[][] })
    .inline_keyboard[0][0].web_app.url;
  assert.match(url, /lat=41\.25&lng=69\.36/);
});

test("unknown product → helpful error, not a crash", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate(textUpdate("banan") as never);
  assert.match(String(messages(sent)[0].payload.text), /topilmadi/);
});

test("voice without STT configured → asks to type", { skip: !backendUp && "backend not running" }, async () => {
  delete process.env.OPENAI_API_KEY;
  const { bot, sent } = harness();
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: 1, date: 0, chat, from: user("en"), voice: { file_id: "x", file_unique_id: "y", duration: 2 } },
  } as never);
  assert.match(String(messages(sent)[0].payload.text), /speech recognition isn't connected/);
});

test("backend down → friendly message", async () => {
  const bot = createBot({ token: "000:fake", backendUrl: "http://127.0.0.1:9" });
  const sent: Sent[] = [];
  bot.api.config.use(async (_p, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
  bot.botInfo = { id: 1, is_bot: true, first_name: "b", username: "b" } as never;
  await bot.handleUpdate(textUpdate("pomidor") as never);
  assert.match(String(messages(sent)[0].payload.text), /Server javob bermayapti/);
});
