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
// Fresh Telegram user id per run so the daily quota never accumulates across test runs.
const UID = 100_000 + Math.floor(Math.random() * 900_000);
const user = (lang = "uz") => ({ id: UID, is_bot: false, first_name: "Test", language_code: lang });
const chat = { id: UID, type: "private" as const };
const textUpdate = (text: string, lang?: string) => ({
  update_id: updateId++,
  message: { message_id: updateId, date: 0, chat, from: user(lang), text },
});
// Result messages only — the bot may first send a "🧠 Got it: …" line when the LLM parser is on.
const messages = (sent: Sent[]) => sent.filter((s) => s.method === "sendMessage" && !String(s.payload.text).startsWith("🧠"));

test("/start greets with an Open-the-app button, then a share-location keyboard — no product buttons", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate({
    ...textUpdate("/start"),
    message: { ...textUpdate("/start").message, entities: [{ type: "bot_command", offset: 0, length: 6 }] },
  } as never);
  const [greet, loc] = messages(sent);
  assert.match(String(greet.payload.text), /Bozorchi AI/);
  const inline = (greet.payload.reply_markup as { inline_keyboard: { text: string; web_app: { url: string } }[][] }).inline_keyboard;
  assert.match(inline[0][0].text, /Ilovani ochish/);
  assert.equal(inline[0][0].web_app.url, "https://bazarcha.example/miniapp");
  const kb = (loc.payload.reply_markup as { keyboard: { text: string; request_location?: boolean }[][] }).keyboard;
  assert.equal(kb.length, 1);
  assert.equal(kb[0].length, 1);
  assert.equal(kb[0][0].request_location, true);
  assert.doesNotMatch(JSON.stringify(sent), /Pomidor|Kartoshka|Piyoz/);
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
  const rows = (m.payload.reply_markup as { inline_keyboard: { text: string; web_app?: { url: string } }[][] }).inline_keyboard;
  const btn = rows[rows.length - 1][0] as { text: string; web_app: { url: string } };
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
  assert.match(text, /Qo'yliq Ulgurji/); // the wholesaler 300 m away is in the top 3 (distance is 20% of the score)
  const rows2 = (messages(sent)[1].payload.reply_markup as { inline_keyboard: { web_app?: { url: string } }[][] }).inline_keyboard;
  const url = rows2[rows2.length - 1][0].web_app!.url;
  assert.match(url, /lat=41\.25&lng=69\.36/);
});

test("unknown product → helpful error, not a crash", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate(textUpdate("samolyot") as never); // an airplane — not something a bazaar sells
  // keyword path → "not found"; LLM path → "which product do you need?" — both are correct
  assert.match(String(messages(sent)[0].payload.text), /topilmadi|tushunmadim/);
});

test("voice message → asks to type when STT is off, or tries to fetch the file when it's on", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: 1, date: 0, chat, from: user("en"), voice: { file_id: "x", file_unique_id: "y", duration: 2 } },
  } as never);
  // with a fake bot token the file download fails → "server not responding"; without STT → "not connected"
  assert.match(String(messages(sent)[0].payload.text), /speech recognition isn't connected|server isn't responding/);
});

test("results carry one 📞 button per seller plus the app link; search itself is never gated", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  for (let i = 0; i < 8; i++) await bot.handleUpdate(textUpdate("kartoshka", "en") as never); // 8 searches: no quota, no 402
  const msgs = messages(sent);
  assert.equal(msgs.length, 8);
  const kb = (msgs[7].payload.reply_markup as { inline_keyboard: { text: string; callback_data?: string; web_app?: { url: string } }[][] }).inline_keyboard;
  const contactRows = kb.filter((r) => r[0].callback_data?.startsWith("unlock:"));
  assert.equal(contactRows.length, 3);
  assert.match(contactRows[0][0].text, /^📞 /);
  assert.ok(kb[kb.length - 1][0].web_app, "last row opens the Mini App");
  const trendRow = kb.find((r) => r[0].callback_data?.startsWith("trend:"));
  assert.ok(trendRow, "has a trend button");
  assert.match(trendRow![0].text, /📈/);
});

test("📈 trend button → chart photo with a caption naming trend and forecast", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate({ update_id: updateId++, callback_query: { id: "1", from: user("en"), chat_instance: "x", data: "trend:tomato:toshkent-shahri", message: { message_id: 1, date: 0, chat, text: "…" } } } as never);
  const photo = sent.find((s) => s.method === "sendPhoto");
  assert.ok(photo, "sendPhoto was called");
  assert.match(String(photo!.payload.caption), /<b>Tomato<\/b> · Tashkent city/);
  assert.match(String(photo!.payload.caption), /Trend: 📈 rising/);
  assert.match(String(photo!.payload.caption), /Forecast:/);
});

const cbUpdate = (sellerId: number, id: number, lang = "en") => ({
  update_id: updateId++,
  callback_query: { id: String(updateId), from: { id, is_bot: false, first_name: "Test", language_code: lang }, chat_instance: "x", data: `unlock:${sellerId}`, message: { message_id: 1, date: 0, chat: { id, type: "private" as const }, text: "…" } },
});
const sellerIds = backendUp ? ((await (await fetch(`${BACKEND_URL}/sellers`)).json()) as { sellers: { id: number }[] }).sellers.map((s) => s.id) : [];

test("free buyer: 3 contact unlocks a day succeed, the 4th gets the upgrade prompt naming Pro / 20", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  const id = UID + 10;
  for (let i = 0; i < 3; i++) await bot.handleUpdate(cbUpdate(sellerIds[i], id) as never);
  const msgs = messages(sent);
  assert.match(String(msgs[0].payload.text), /☎️ \+998/);
  assert.match(String(msgs[0].payload.text), /maps\.google\.com/);
  assert.match(String(msgs[2].payload.text), /3\/3 contacts used/);
  await bot.handleUpdate(cbUpdate(sellerIds[3], id) as never);
  const fourth = String(messages(sent)[3].payload.text);
  assert.match(fourth, /Free plan: 3\/3/);
  assert.match(fourth, /Upgrade to <b>Pro<\/b> — 20 contacts\/day/);
  // re-requesting an earlier seller still works and is not charged
  await bot.handleUpdate(cbUpdate(sellerIds[1], id) as never);
  assert.match(String(messages(sent)[4].payload.text), /Already unlocked/);
});

test("/upgrade max → verified buyer; the seller-facing notice carries the ✅ tag", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  const id = UID + 20;
  const cmd = { ...textUpdate("/upgrade max", "en"), message: { ...textUpdate("/upgrade max", "en").message, chat: { id, type: "private" as const }, from: { id, is_bot: false, first_name: "Bahor", language_code: "en" }, entities: [{ type: "bot_command", offset: 0, length: 8 }] } };
  await bot.handleUpdate(cmd as never);
  assert.match(String(messages(sent)[0].payload.text), /Verified buyer/);
  await bot.handleUpdate(cbUpdate(sellerIds[0], id) as never);
  const contact = String(messages(sent)[1].payload.text);
  assert.match(contact, /✅ Tasdiqlangan xaridor/);
  assert.match(contact, /unlimited contacts/);
});

test("a multi-product message → assistant answer with one contact button per item", { skip: !backendUp && "backend not running" }, async () => {
  const { bot, sent } = harness();
  await bot.handleUpdate(textUpdate("500 kg pomidor, 200 kg piyoz va 100 kg sabzi kerak, arzon bo'lsin", "uz") as never);
  const m = messages(sent)[0];
  assert.match(String(m.payload.text), /^🎙️ Sizga 3 ta mahsulot kerak/);
  const rows = (m.payload.reply_markup as { inline_keyboard: { text: string; callback_data?: string }[][] }).inline_keyboard;
  assert.equal(rows.filter((r) => r[0].callback_data?.startsWith("unlock:")).length, 3);
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
