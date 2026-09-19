/**
 * Voice-first AI assistant: one spoken/typed request with several products, quantities and
 * preferences ("not far", "good quality", "cheap") → structured plan → ranked picks per item and a
 * whole-basket quote → a short answer in the user's language.
 */
import { parseBasket, quoteBasket } from "./basket.js";
import { callJson, toKg } from "./nlp.js";
import { productLabel, productUnit, resolveProduct, UNIT_LABEL, type Unit } from "./products.js";
import { recommend } from "./recommend.js";
import { DEFAULT_WEIGHTS, type Weights } from "./scoring.js";

export type Priority = "price" | "quality" | "distance" | "balanced";

export const ASSISTANT_PROMPT =
  "You are the shopping assistant of an Uzbekistan bazaar app. The user says what they want to buy — possibly several products, " +
  "with quantities, and preferences about distance, quality or price. Input may be Uzbek (Latin or Cyrillic), Russian, or mixed, with typos or voice-transcript messiness. " +
  "Respond with ONLY a JSON object, no other text, no markdown fences:\n" +
  '{"items":[{"product":string,"quantity":number|null,"unit":string|null}], "maxDistanceKm":number|null, "priority":"price"|"quality"|"distance"|"balanced", "region":string|null, "lang":"uz"|"ru"|"en"}\n' +
  "List every product mentioned as its own item, in the user's words. Normalize units (kg, t → kg; dona/шт → dona; qop/мешок → qop; litr/л → l; metr/м → m). " +
  "priority = what they stress most: cheap → price; good/fresh/quality → quality; near/close/quick → distance; otherwise balanced. " +
  "maxDistanceKm only if they state a distance. lang = the language they spoke. Never invent quantities.";

/** Weights per priority — the same formula, just nudged toward what the user asked for. */
export const PRIORITY_WEIGHTS: Record<Priority, Weights> = {
  balanced: DEFAULT_WEIGHTS,
  price: { price: 0.6, quality: 0.25, distance: 0.15 },
  quality: { price: 0.3, quality: 0.5, distance: 0.2 },
  distance: { price: 0.3, quality: 0.25, distance: 0.45 },
};

export interface AssistantPlan {
  items: { product: string; quantity: number | null; unit: string | null }[];
  maxDistanceKm: number | null;
  priority: Priority;
  region: string | null;
  lang: "uz" | "ru" | "en";
  source: "llm" | "keywords";
}

const detectLang = (t: string): "uz" | "ru" | "en" => (/[а-яё]/i.test(t) ? (/[ўқғҳ]/i.test(t) ? "uz" : "ru") : /\b(the|need|want|kg|please)\b/i.test(t) && !/\b(kerak|menga|va)\b/i.test(t) ? "en" : "uz");

/** Keyword fallback when the LLM is unavailable: basket parser + a few preference words. */
export function keywordPlan(text: string): AssistantPlan {
  const { items } = parseBasket(text.replace(/\b(va|и|and)\b/gi, ","));
  const dist = text.match(/(\d+(?:[.,]\d+)?)\s*(km|км|kilometr|километр)/i);
  const t = text.toLowerCase();
  const priority: Priority = /arzon|cheap|дешев|narx/.test(t) ? "price" : /sifat|quality|качеств|fresh|yangi|свеж/.test(t) ? "quality" : /yaqin|near|close|близ|рядом|tez/.test(t) ? "distance" : "balanced";
  return { items: items.map((i) => ({ product: i.product, quantity: i.quantityKg, unit: productUnit(i.product) })), maxDistanceKm: dist ? parseFloat(dist[1].replace(",", ".")) : null, priority, region: null, lang: detectLang(text), source: "keywords" };
}

export async function planRequest(text: string): Promise<AssistantPlan> {
  const j = (await callJson(text, ASSISTANT_PROMPT)) as Partial<AssistantPlan> | null;
  if (!j || !Array.isArray(j.items) || !j.items.length) return keywordPlan(text);
  const items = j.items
    .map((it) => ({ product: String(it?.product ?? "").trim(), quantity: typeof it?.quantity === "number" && it.quantity > 0 ? it.quantity : null, unit: it?.unit ? String(it.unit).toLowerCase() : null }))
    .filter((it) => it.product);
  const priority: Priority = (["price", "quality", "distance", "balanced"] as Priority[]).includes(j.priority as Priority) ? (j.priority as Priority) : "balanced";
  const lang = (["uz", "ru", "en"] as const).includes(j.lang as never) ? (j.lang as "uz" | "ru" | "en") : detectLang(text);
  return { items, maxDistanceKm: typeof j.maxDistanceKm === "number" && j.maxDistanceKm > 0 ? j.maxDistanceKm : null, priority, region: j.region ? String(j.region) : null, lang, source: "llm" };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
const unitLbl = (u: string, lang: "uz" | "ru" | "en") => UNIT_LABEL[(u as Unit) in UNIT_LABEL ? (u as Unit) : "kg"][lang];

export async function runAssistant(req: { text: string; province?: string; region?: string; lat?: number; lng?: number; personalWeights?: Weights }) {
  const plan = await planRequest(req.text);
  const weights = plan.priority === "balanced" ? req.personalWeights ?? DEFAULT_WEIGHTS : PRIORITY_WEIGHTS[plan.priority];
  const lang = plan.lang;

  const resolved = plan.items.map((it) => ({ ...it, key: resolveProduct(it.product) }));
  const unknown = resolved.filter((r) => !r.key).map((r) => r.product);
  const known = resolved.filter((r) => r.key) as ({ key: string } & typeof resolved[number])[];

  const items = await Promise.all(known.map(async (it) => {
    const unit = productUnit(it.key);
    const qty = it.quantity != null ? (unit === "kg" ? toKg(it.quantity, it.unit ?? "kg") ?? it.quantity : it.quantity) : null;
    const r = await recommend({ product: it.key, province: req.province, region: req.region ?? plan.region ?? undefined, lat: req.lat, lng: req.lng, quantityKg: qty ?? undefined, radiusKm: plan.maxDistanceKm ?? undefined, weights, allowWeights: true, maxResults: 3, limit: 3 });
    return { product: it.key, label: productLabel(it.key), unit, quantity: qty, said: it.product, candidates: r.candidates, best: r.results[0] ?? null, top: r.results, excluded: r.excluded.length };
  }));

  const basketItems = items.filter((i) => i.best).map((i) => ({ product: i.product, quantityKg: i.quantity ?? i.best!.minOrderKg ?? 1 }));
  const quote = basketItems.length >= 2 ? await quoteBasket({ items: basketItems, province: req.province, region: req.region ?? plan.region ?? undefined, lat: req.lat, lng: req.lng }) : null;

  // ---- the spoken answer (templated in the user's language — no second LLM call, quotas are precious)
  const L = {
    uz: { intro: (n: number) => `Sizga ${n} ta mahsulot kerak:`, none: "Kechirasiz, qaysi mahsulot kerakligini tushunmadim.", unknown: (u: string) => `"${u}" ni tanimadim.`, best: (l: string, s: string, p: string, d: string) => `${l} — eng mosi ${s}: ${p}, ${d} km.`, nothing: (l: string) => `${l} — bu hududda mos taklif topilmadi.`, single: (s: string, t: string) => `Hammasini bitta joydan olsangiz — ${s}, jami ${t} so'm (yetkazib berish bilan).`, split: (n: number, t: string, save: string | null) => save ? `Bo'lib olsangiz (${n} ta sotuvchi) jami ${t} so'm — ${save} so'm tejaysiz.` : `Buni ${n} ta sotuvchidan bo'lib olish kerak: jami ${t} so'm (yetkazib berish bilan).`, pref: { price: "Eng arzon narxlarga urg'u berdim.", quality: "Sifatli, ishonchli sotuvchilarga urg'u berdim.", distance: "Yaqin sotuvchilarga urg'u berdim.", balanced: "" }, dist: (k: number) => `Faqat ${k} km radiusda qaradim.` },
    ru: { intro: (n: number) => `Вам нужно ${n} товар(а):`, none: "Простите, не понял, какие товары нужны.", unknown: (u: string) => `«${u}» не распознал.`, best: (l: string, s: string, p: string, d: string) => `${l} — лучше всего у ${s}: ${p}, ${d} км.`, nothing: (l: string) => `${l} — подходящих предложений в этом регионе нет.`, single: (s: string, t: string) => `Если брать всё в одном месте — ${s}, итого ${t} сум с доставкой.`, split: (n: number, t: string, save: string | null) => save ? `Если разбить (${n} продавца) — ${t} сум, экономия ${save} сум.` : `Придётся брать у ${n} продавцов: итого ${t} сум с доставкой.`, pref: { price: "Сделал упор на низкую цену.", quality: "Сделал упор на качество и надёжных продавцов.", distance: "Сделал упор на близких продавцов.", balanced: "" }, dist: (k: number) => `Искал только в радиусе ${k} км.` },
    en: { intro: (n: number) => `You need ${n} product(s):`, none: "Sorry, I couldn't tell which products you need.", unknown: (u: string) => `I didn't recognise "${u}".`, best: (l: string, s: string, p: string, d: string) => `${l} — best from ${s}: ${p}, ${d} km away.`, nothing: (l: string) => `${l} — no suitable offers in this region.`, single: (s: string, t: string) => `Buying everything from one place — ${s}, ${t} so'm total with delivery.`, split: (n: number, t: string, save: string | null) => save ? `Splitting across ${n} sellers — ${t} so'm, saving ${save} so'm.` : `You'll need ${n} sellers: ${t} so'm total with delivery.`, pref: { price: "I prioritised the lowest prices.", quality: "I prioritised quality and reliable sellers.", distance: "I prioritised nearby sellers.", balanced: "" }, dist: (k: number) => `I only looked within ${k} km.` },
  }[lang];
  const lines: string[] = [];
  if (!items.length) lines.push(L.none);
  else {
    lines.push(L.intro(items.length) + " " + items.map((i) => `${i.quantity ? `${fmt(i.quantity)} ${unitLbl(i.unit, lang)} ` : ""}${i.label?.[lang] ?? i.product}`).join(", ") + ".");
    for (const i of items) lines.push(i.best ? L.best(i.label?.[lang] ?? i.product, i.best.sellerName, `${fmt(i.best.pricePerKg)} so'm/${unitLbl(i.unit, lang)}`, String(i.best.distanceKm)) : L.nothing(i.label?.[lang] ?? i.product));
    if (quote) {
      if (quote.single) lines.push(L.single(quote.single.sellerName, fmt(quote.single.total)));
      if (quote.recommended === "split" && quote.split.sellerCount > 1) lines.push(L.split(quote.split.sellerCount, fmt(quote.split.total), quote.single && quote.savings ? fmt(quote.savings) : null));
    }
    if (L.pref[plan.priority]) lines.push(L.pref[plan.priority]);
    if (plan.maxDistanceKm) lines.push(L.dist(plan.maxDistanceKm));
  }
  for (const u of unknown) lines.push(L.unknown(u));

  return { transcript: req.text, plan, weights, items, unknown, quote, answer: lines.join(" "), lang };
}
