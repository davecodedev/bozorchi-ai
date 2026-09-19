import { Bot, InlineKeyboard, InputFile, Keyboard, type Context } from "grammy";
import { ApiError, assistant, marketChart, parse, recommend, setTier, unlockContact, type ParsedQuery, type Tier } from "./api.js";
import { formatRecommendation } from "./format.js";
import { pickLang, t } from "./i18n.js";
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

  bot.command("start", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    // 1. greeting with the app link (inline button — Telegram needs an https URL for web_app)
    await ctx.reply(s.start, {
      parse_mode: "HTML",
      reply_markup: miniAppUrl ? new InlineKeyboard().webApp(s.openAppBtn, miniAppUrl) : undefined,
    });
    // 2. a persistent "share location" key under the keyboard (reply keyboards can't be combined with inline ones)
    await ctx.reply(s.locationPrompt, { reply_markup: new Keyboard().requestLocation(s.locationBtn).resized() });
  });

  /** Demo-only tier switch: /upgrade pro | max | free. Real checkout will replace the body, not the command. */
  bot.command("upgrade", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    const tier = (ctx.match || "").trim().toLowerCase() as Tier;
    if (!["free", "pro", "max"].includes(tier)) return ctx.reply(s.upgradeUsage);
    try {
      const r = await setTier(backendUrl, tier, callerOf(ctx));
      await ctx.reply(s.upgraded(r.tier, r.usage.quota, r.verifiedBuyer), { parse_mode: "HTML" });
    } catch (e) {
      console.error("upgrade failed:", e);
      await ctx.reply(s.backendDown);
    }
  });

  /** "📈 trend" button under results → chart image of 30-day market prices + 7-day forecast. */
  bot.callbackQuery(/^trend:([a-z]+):([a-z-]+)$/, async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    const [, product, province] = ctx.match;
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.replyWithChatAction("upload_photo");
    try {
      const { png, view } = await marketChart(backendUrl, product, province, lang);
      const caption = s.trendCaption(view.label?.[lang] ?? product, view.provinceLabel?.[lang] ?? province, view.current, view.changePct, view.trend.direction, view.forecast);
      await ctx.replyWithPhoto(new InputFile(png, `${product}-trend.png`), { caption, parse_mode: "HTML" });
    } catch (e) {
      console.error("trend chart failed:", e);
      await ctx.reply(s.backendDown);
    }
  });

  /** "📞 <seller>" button under results → reveal contact against the buyer's quota. */
  bot.callbackQuery(/^unlock:(\d+)$/, async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    const sellerId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const r = await unlockContact(backendUrl, sellerId, callerOf(ctx));
      if (r.status === "quota_exceeded") {
        const reply_markup = miniAppUrl ? new InlineKeyboard().webApp(s.openApp, `${miniAppUrl}${miniAppUrl.includes("?") ? "&" : "?"}screen=profile`) : undefined;
        return ctx.reply(s.quotaExceeded(r.tier, r.quota, r.next), { parse_mode: "HTML", reply_markup });
      }
      let text = s.contactMsg(r.contact) + s.contactUsage(r.usage.used, r.usage.quota, r.usage.unlimited);
      if (r.status === "already_unlocked") text = s.alreadyUnlocked + "\n\n" + text;
      else {
        text += s.sellerNotified(r.sellerNotice);
        // real seller-side notification when the seller has linked their Telegram account
        if (r.sellerTelegramUserId) ctx.api.sendMessage(r.sellerTelegramUserId, r.sellerNotice).catch(() => {});
      }
      await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    } catch (e) {
      console.error("unlock failed:", e);
      await ctx.reply(s.backendDown);
    }
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
    if (!(await sttAvailable(backendUrl))) return ctx.reply(s.voiceNoStt);

    await ctx.replyWithChatAction("typing");
    let text = "";
    try {
      const file = await ctx.getFile();
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const audio = Buffer.from(await (await fetch(url)).arrayBuffer());
      text = await transcribe(backendUrl, audio, "audio/ogg"); // Telegram voice notes are OGG/Opus
    } catch (e) {
      console.error("voice transcription failed:", e);
      return ctx.reply(s.backendDown);
    }
    if (!text) return ctx.reply(s.voiceNoStt);
    await ctx.reply(s.voiceHeard(text), { parse_mode: "HTML" });
    await handleQuery(ctx, text);
  });

  bot.on("message:text", async (ctx) => {
    // Strip any leading emoji/punctuation: "🍅 Pomidor" → "Pomidor"
    const text = ctx.message.text.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!text) return;
    await handleQuery(ctx, text);
  });

  const callerOf = (ctx: Context) =>
    ctx.from ? { telegramUserId: ctx.from.id, name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") } : undefined;

  async function handleQuery(ctx: Context, text: string) {
    const lang = pickLang(ctx.from?.language_code);
    const s = t(lang);
    const userId = ctx.from?.id;
    const loc = userId !== undefined ? locations.get(userId) : undefined;

    // 0. Several products in one message ("500 kg pomidor, 200 kg piyoz va 100 kg sabzi…") → the assistant plans it all
    await ctx.replyWithChatAction("typing");
    if (looksMultiItem(text)) {
      try {
        const a = await assistant(backendUrl, text, { region: extractRegion(text), lat: loc?.lat, lng: loc?.lng }, callerOf(ctx));
        if (a.items.length >= 2) {
          const kb = new InlineKeyboard();
          for (const it of a.items) if (it.best) kb.text(s.contactBtn(`${it.best.sellerName} · ${it.product}`), `unlock:${it.best.sellerId}`).row();
          if (miniAppUrl) kb.webApp(s.openApp, `${miniAppUrl}${miniAppUrl.includes("?") ? "&" : "?"}screen=assistant`);
          return ctx.reply(`🎙️ ${a.answer}`, { reply_markup: kb });
        }
      } catch (e) { console.warn("assistant failed, falling back to single-product flow:", e); }
    }

    // 1. Understand the message (LLM). Keep the "typing…" indicator alive while we wait.
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
        callerOf(ctx),
      );

      // one "📞 <seller>" button per result (contact reveal is the only quota-gated action), then the app link
      const kb = new InlineKeyboard();
      for (const r of data.results) kb.text(s.contactBtn(r.sellerName), `unlock:${r.sellerId}`).row();
      kb.text(s.trendBtn, `trend:${data.product}:${data.province ?? "toshkent-shahri"}`).row();
      if (miniAppUrl) kb.webApp(s.openApp, miniAppLink(miniAppUrl, data.product, q.region, loc));
      await ctx.reply(formatRecommendation(data, lang, s, where), { parse_mode: "HTML", reply_markup: kb });
    } catch (e) {
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

  function miniAppLink(miniAppUrl: string, product: string, region?: string, loc?: { lat: number; lng: number }): string {
    const url = new URL(miniAppUrl);
    url.searchParams.set("product", product);
    if (region) url.searchParams.set("region", region);
    if (loc) {
      url.searchParams.set("lat", String(loc.lat));
      url.searchParams.set("lng", String(loc.lng));
    }
    return url.toString();
  }

  bot.catch((err) => {
    console.error("bot error:", err.error);
  });

  return bot;
}

/** Two or more quantities, or list separators, usually mean a multi-product request. */
export function looksMultiItem(text: string): boolean {
  const qtys = (text.match(/\d+(?:[.,]\d+)?\s*(kg|кг|t|tonna|тонн|т|dona|шт|qop|мешок|litr|л|metr|м)\b/gi) || []).length;
  const seps = (text.match(/,|\bva\b|\bи\b|\band\b|\n/gi) || []).length;
  return qtys >= 2 || (qtys >= 1 && seps >= 1);
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
  // the LLM found no catalog product — still let the backend try the raw text (seller-posted custom products)
  if (!parsed.product && !parsed.productKey) return { product: rawText, quantityKg: parsed.quantityKg ?? undefined, region: extractRegion(rawText) ?? lastRegion };
  const region = (parsed.region ? extractRegion(parsed.region) : undefined) ?? extractRegion(rawText) ?? lastRegion;
  return { product: parsed.productKey ?? parsed.product, quantityKg: parsed.quantityKg ?? undefined, region };
}
