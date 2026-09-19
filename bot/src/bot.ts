import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { ApiError, parse, recommend, type ParsedQuery } from "./api.js";
import { formatRecommendation } from "./format.js";
import { PRODUCT_BUTTONS, pickLang, t } from "./i18n.js";
import { extractRegion } from "./region.js";
import { sttAvailable, transcribe } from "./stt.js";

export interface BotConfig {
  token: string;
  backendUrl: string;
  /** https:// URL of the Mini App, or undefined to disable the button. */
  miniAppUrl?: string;
}

/** Builds the bot with all handlers attached. Does not start polling — index.ts does that. */
export function createBot({ token, backendUrl, miniAppUrl }: BotConfig) {
  const bot = new Bot(token);

  /** Last shared location per user. In-memory is fine for the demo. */
  const locations = new Map<number, { lat: number; lng: number }>();
  /** Last district a user searched in — the default when a new message doesn't name one. */
  const lastRegions = new Map<number, string>();

  const startKeyboard = (lang: ReturnType<typeof pickLang>) => {
    const kb = new Keyboard();
    for (const b of PRODUCT_BUTTONS[lang]) kb.text(b);
    return kb.row().requestLocation(t(lang).locationBtn).resized();
  };

  bot.command("start", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    await ctx.reply(t(lang).start, { parse_mode: "HTML", reply_markup: startKeyboard(lang) });
  });

  bot.command("help", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    await ctx.reply(t(lang).help, { parse_mode: "HTML" });
  });

  bot.on("message:location", async (ctx) => {
    const lang = pickLang(ctx.from.language_code);
    const { latitude: lat, longitude: lng } = ctx.message.location;
    locations.set(ctx.from.id, { lat, lng });
    await ctx.reply(t(lang).locationSaved);
  });

  bot.on("message:voice", async (ctx) => {
    const lang = pickLang(ctx.from.language_code);
    const s = t(lang);
    if (!sttAvailable()) return ctx.reply(s.voiceNoStt);

    await ctx.replyWithChatAction("typing");
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const audio = Buffer.from(await (await fetch(url)).arrayBuffer());
    const text = await transcribe(audio);
    if (!text) return ctx.reply(s.voiceNoStt);
    await ctx.reply(s.voiceHeard(text), { parse_mode: "HTML" });
    await handleQuery(ctx, text);
  });

  bot.on("message:text", async (ctx) => {
    // Strip the emoji from quick-pick buttons: "🍅 Pomidor" → "Pomidor"
    const text = ctx.message.text.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!text) return;
    await handleQuery(ctx, text);
  });

  async function handleQuery(ctx: Context, text: string) {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    const userId = ctx.from?.id;
    const loc = userId !== undefined ? locations.get(userId) : undefined;

    // 1. Understand the message (LLM). Keep the "typing…" indicator alive while we wait.
    await ctx.replyWithChatAction("typing");
    const parsed = await parse(backendUrl, text);
    const q = resolveQuery(text, parsed, userId !== undefined ? lastRegions.get(userId) : undefined);

    // 2. No product → ask, don't guess.
    if (!q.product) return ctx.reply(s.askProduct, { parse_mode: "HTML" });
    if (userId !== undefined && q.region) lastRegions.set(userId, q.region);
    const where = loc ? s.nearMe : (q.region ?? s.tashkent);
    if (parsed.available) await ctx.reply(s.understood(parsed.product ?? q.product, q.quantityKg ?? null, q.region ?? null), { parse_mode: "HTML" });

    // 3. Rank — exactly the same /recommend call as before, just with structured input.
    await ctx.replyWithChatAction("typing");
    try {
      const data = await recommend(
        backendUrl,
        { product: q.product, region: q.region, quantityKg: q.quantityKg, lat: loc?.lat, lng: loc?.lng, limit: 3 },
        ctx.from ? { telegramUserId: ctx.from.id, name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") } : undefined,
      );

      const reply_markup = miniAppUrl ? miniAppKeyboard(miniAppUrl, s.openApp, data.product, q.region, loc) : undefined;
      const usageLine = data.usage && data.usage.limit != null ? s.usageLine(data.usage.used, data.usage.limit) : "";
      await ctx.reply(formatRecommendation(data, lang, s, where) + usageLine, {
        parse_mode: "HTML",
        reply_markup,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        const reply_markup = miniAppUrl ? new InlineKeyboard().webApp(s.upgradeBtn, `${miniAppUrl}${miniAppUrl.includes("?") ? "&" : "?"}screen=profile`) : undefined;
        return ctx.reply(s.limitReached, { reply_markup });
      }
      if (e instanceof ApiError && e.status === 404) {
        return ctx.reply(s.unknownProduct(parsed.product ?? text), { parse_mode: "HTML" });
      }
      if (e instanceof ApiError && e.status === 400) {
        return ctx.reply(s.help, { parse_mode: "HTML" });
      }
      console.error("recommend failed:", e);
      await ctx.reply(s.backendDown);
    }
  }

  function miniAppKeyboard(
    miniAppUrl: string,
    label: string,
    product: string,
    region?: string,
    loc?: { lat: number; lng: number },
  ) {
    const url = new URL(miniAppUrl);
    url.searchParams.set("product", product);
    if (region) url.searchParams.set("region", region);
    if (loc) {
      url.searchParams.set("lat", String(loc.lat));
      url.searchParams.set("lng", String(loc.lng));
    }
    return new InlineKeyboard().webApp(label, url.toString());
  }

  bot.catch((err) => {
    console.error("bot error:", err.error);
  });

  return bot;
}

export interface ResolvedQuery {
  /** What to send as `product` to /recommend, or null to ask the buyer. */
  product: string | null;
  quantityKg: number | undefined;
  /** Tashkent district key, or undefined. */
  region: string | undefined;
}

/**
 * Merge the LLM's structured fields with our fallbacks:
 *  - parser unavailable (no API key) → old behaviour: raw text + keyword district extraction
 *  - parser ran but found no product   → null (bot asks) — unless keyword matching on the raw text found one
 *  - region: parsed region → district alias map; else district named anywhere in the raw text; else the user's last region
 */
export function resolveQuery(rawText: string, parsed: ParsedQuery, lastRegion?: string): ResolvedQuery {
  if (!parsed.available) {
    return { product: rawText, quantityKg: undefined, region: extractRegion(rawText) ?? lastRegion };
  }
  if (!parsed.product && !parsed.productKey) return { product: null, quantityKg: undefined, region: undefined };
  const region = (parsed.region ? extractRegion(parsed.region) : undefined) ?? extractRegion(rawText) ?? lastRegion;
  return { product: parsed.productKey ?? parsed.product, quantityKg: parsed.quantityKg ?? undefined, region };
}
