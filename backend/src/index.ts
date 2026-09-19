import "dotenv/config";
import express, { type Request, type Response } from "express";
import { getOrCreateBuyer, identify } from "./auth.js";
import { parseBasket, quoteBasket } from "./basket.js";
import { forecast } from "./history.js";
import { isUnlocked, unlockContact, usageOf } from "./contactUnlock.js";
import { setTier, TIERS, tierOf, type Tier } from "./tiers.js";
import { acceptDeal, counterDeal, createDeal, declineDeal, DealError, getDeal, listDeals, mayActAsSeller, presentDeal, type Actor } from "./deals.js";
import { nlpAvailable, parseQuery, toKg } from "./nlp.js";
import { explainAnomalies } from "./anomaly.js";
import { forecastTrend, FORECAST_WINDOW_DAYS } from "./forecast.js";
import { computeReliabilityBulk } from "./reliability.js";
import { getPersonalWeights } from "./scoring.js";
import { marketChartPng, marketChartSvg, marketView } from "./market.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES } from "./geo.js";
import { CATEGORIES, PRODUCTS, resolveProduct, UNIT_LABEL } from "./products.js";
import { prisma } from "./db.js";
import { recommend, RecommendError } from "./recommend.js";
import { DEFAULT_WEIGHTS } from "./scoring.js";
import { getSeller, listSellers } from "./sellers.js";

const app = express();
app.use(express.json());

// Mini App may be served from another origin (e.g. Vercel) — allow it.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "bozorchi-ai-backend" }));

// ---------------------------------------------------------------- account & tiers
const buyerOf = (req: Request) => getOrCreateBuyer(identify(req));

app.get("/me", async (req, res) => {
  const b = await buyerOf(req);
  res.json({ buyer: { id: b.id, telegramUserId: b.telegramUserId, name: b.name, username: b.username, tier: tierOf(b), verifiedBuyer: b.verifiedBuyer, upgradedAt: b.upgradedAt }, usage: await usageOf(b), tiers: TIERS });
});

/** Mock checkout for the demo — flips the tier via tiers.setTier(). Payme / Click / Stars plug in there later. */
app.post("/me/upgrade", async (req, res) => {
  const b = await buyerOf(req);
  const tier = req.body?.tier as Tier;
  if (!["free", "pro", "max"].includes(tier)) return res.status(400).json({ error: "tier must be free | pro | max" });
  const u = await setTier(b.id, tier);
  res.json({ ok: true, tier: tierOf(u), verifiedBuyer: u.verifiedBuyer, usage: await usageOf(u) });
});

/**
 * Reveal a seller's phone + exact location. The only tier-gated action in the whole product.
 *   unlocked / already_unlocked → contact + the notice the seller receives (with ✅ tag for Max buyers)
 *   quota_exceeded → tier, quota and the next tier to offer
 */
app.post("/sellers/:id/unlock", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  try {
    const b = await buyerOf(req);
    const r = await unlockContact(b.telegramUserId, id);
    res.status(r.status === "quota_exceeded" ? 402 : 200).json(r);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

/** Everything the Mini App needs to draw its chips. */
app.get("/meta", (_req, res) =>
  res.json({
    products: PRODUCTS.map(({ key, category, unit, label }) => ({ key, category, unit, label })),
    categories: CATEGORIES,
    units: UNIT_LABEL,
    provinces: PROVINCES.map(({ key, label }) => ({ key, label })),
    defaultWeights: DEFAULT_WEIGHTS,
  }),
);

app.get("/products", (_req, res) => res.json({ products: PRODUCTS, defaultWeights: DEFAULT_WEIGHTS }));

const hideContact = <T extends { phone?: string | null; lat?: number; lng?: number }>(s: T) => { const { phone: _p, lat: _a, lng: _b, ...rest } = s; return rest; };

app.get("/sellers", async (req, res) => {
  try {
    const { province, category, q } = req.query as Record<string, string | undefined>;
    res.json({ sellers: (await listSellers({ province, category: category as never, q })).map(hideContact) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/sellers/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  const seller = await getSeller(id);
  if (!seller) return res.status(404).json({ error: "seller not found" });
  const b = await buyerOf(req);
  const unlocked = await isUnlocked(b.telegramUserId, id);
  res.json({ seller: { ...hideContact(seller), contactUnlocked: unlocked, ...(unlocked ? { contact: { phone: seller.phone, lat: seller.lat, lng: seller.lng, mapsUrl: `https://maps.google.com/?q=${seller.lat},${seller.lng}` } } : {}) } });
});

/**
 * LLM parsing of a raw buyer message (see nlp.ts). Never fails: without a key it reports
 * `available: false` so the bot can keep using keyword matching.
 */
app.post("/parse", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!nlpAvailable()) return res.json({ available: false, product: null, quantity: null, unit: null, region: null, productKey: null, quantityKg: null });
  const parsed = await parseQuery(text);
  res.json({
    available: true,
    ...parsed,
    // canonical key if the model's product name is one we sell ("помидоры" → "tomato"). When the
    // model returned nothing (rate limit, outage), fall back to keyword matching on the raw text so
    // a plain "kartoshka" still works — the bot only asks when neither finds a product.
    productKey: parsed.product ? resolveProduct(parsed.product) : resolveProduct(text),
    quantityKg: toKg(parsed.quantity, parsed.unit),
  });
});

app.post("/recommend", async (req, res) => {
  try {
    // Search and ranking are free and unmetered for every tier — no quota, no feature gate.
    const b = await buyerOf(req);
    const personal = await getPersonalWeights(b.telegramUserId); // P4
    const data = await recommend({
      ...(req.body ?? {}),
      maxResults: 10,
      allowWeights: true,
      personalWeights: personal.preference ? personal.weights : undefined,
    });
    (data as Record<string, unknown>).personalization = { preference: personal.preference, contacts: personal.contacts };
    res.json({ ...data, usage: await usageOf(b) });
  } catch (e) {
    if (e instanceof RecommendError) {
      return res.status(e.status).json({ error: e.message, ...(e.extra as object) });
    }
    console.error(e);
    res.status(500).json({ error: "internal error" });
  }
});

/** 30-day series from real price reports (all tiers) + 7-day forecast (Enterprise) + 30-day trend (P3). */
app.get("/history/:sellerId/:product", async (req, res) => {
  const sellerId = Number(req.params.sellerId);
  const seller = Number.isInteger(sellerId) ? await getSeller(sellerId) : null;
  const listing = seller?.products.find((p) => p.product === req.params.product);
  if (!seller || !listing) return res.status(404).json({ error: "listing not found" });
  const DAYS = 30;
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const rows = await prisma.priceHistory.findMany({ where: { sellerId, product: listing.product, reportedAt: { gte: since } }, orderBy: { reportedAt: "asc" }, select: { price: true, reportedAt: true } });
  // one point per day; days without a report carry the previous price forward
  const byDay = new Map<number, number>();
  for (const r of rows) byDay.set(Math.floor((r.reportedAt.getTime() - since.getTime()) / 86_400_000), r.price);
  const series: number[] = [];
  let last = rows[0]?.price ?? listing.pricePerKg;
  for (let d = 0; d <= DAYS; d++) { if (byDay.has(d)) last = byDay.get(d)!; series.push(last); }
  series[series.length - 1] = listing.pricePerKg;
  const first = series[0], current = series[series.length - 1];
  const body: Record<string, unknown> = {
    sellerId: seller.id, sellerName: seller.name, bazaar: seller.bazaar, province: seller.province, product: listing.product,
    series, current, changePct: Math.round(((current - first) / first) * 100), reports: rows.length, seeded: true,
    trend: await forecastTrend(listing.product, seller.province), // market-wide, not just this seller
  };
  body.forecast = forecast(series); // free for every tier
  res.json(body);
});

// ---------------------------------------------------------------- deals
const dealErr = (res: Response, e: unknown) => {
  if (e instanceof DealError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: "internal error" });
};
/** Which side the caller is acting as. Buyers are identified by their Telegram id; the seller side is the
 *  seller's linked Telegram account, or anyone in demo mode (sellers have no accounts yet). */
const actorFor = async (req: Request, dealId: string): Promise<{ actor: Actor; telegramUserId: string }> => {
  const b = await buyerOf(req);
  const d = await getDeal(dealId);
  const asSeller = req.body?.actor === "seller";
  if (asSeller && !mayActAsSeller(d, b.telegramUserId)) throw new DealError(403, "not this deal's seller");
  if (!asSeller && d.buyer.telegramUserId !== b.telegramUserId) throw new DealError(403, "not this deal's buyer");
  return { actor: asSeller ? "seller" : "buyer", telegramUserId: b.telegramUserId };
};

app.post("/deals", async (req, res) => {
  try {
    const b = await buyerOf(req);
    const d = await createDeal(b.telegramUserId, req.body ?? {});
    res.status(201).json({ deal: presentDeal(d) });
  } catch (e) { dealErr(res, e); }
});
app.get("/deals", async (req, res) => {
  const b = await buyerOf(req);
  res.json({ deals: (await listDeals(b.telegramUserId)).map((d) => presentDeal(d)) });
});
app.get("/deals/:id", async (req, res) => {
  try {
    const b = await buyerOf(req);
    const d = await getDeal(req.params.id);
    const viewer: Actor = d.buyer.telegramUserId === b.telegramUserId ? "buyer" : "seller";
    res.json({ deal: presentDeal(d, viewer), viewer, demoSellerActions: mayActAsSeller(d, b.telegramUserId) });
  } catch (e) { dealErr(res, e); }
});
app.post("/deals/:id/counter", async (req, res) => {
  try {
    const { actor } = await actorFor(req, req.params.id);
    if (actor !== "seller") throw new DealError(403, "only the seller can counter");
    res.json({ deal: presentDeal(await counterDeal(req.params.id, req.body?.pricePerKg), "buyer") });
  } catch (e) { dealErr(res, e); }
});
app.post("/deals/:id/accept", async (req, res) => {
  try {
    const { actor } = await actorFor(req, req.params.id);
    res.json({ deal: presentDeal(await acceptDeal(req.params.id, actor), "buyer") });
  } catch (e) { dealErr(res, e); }
});
app.post("/deals/:id/decline", async (req, res) => {
  try {
    const { actor } = await actorFor(req, req.params.id);
    res.json({ deal: presentDeal(await declineDeal(req.params.id, actor), "buyer") });
  } catch (e) { dealErr(res, e); }
});

/** Market price history + forecast for a product in a province (JSON, SVG or PNG). */
app.get("/market/:product{.:ext}", async (req, res) => {
  const product = resolveProduct(req.params.product) ?? req.params.product;
  const lang = (["uz", "ru", "en"].includes(String(req.query.lang)) ? String(req.query.lang) : "uz") as "uz" | "ru" | "en";
  const m = await marketView(product, (req.query.province as string) || "toshkent-shahri");
  const ext = (req.params as Record<string, string | undefined>).ext;
  if (ext === "png") { res.type("png").set("cache-control", "no-store").send(marketChartPng(m, lang)); return; }
  if (ext === "svg") { res.type("svg").send(marketChartSvg(m, lang)); return; }
  res.json(m);
});

/** P2: z-score price anomalies over current listings, grouped by product × province. */
app.get("/anomalies", async (_req, res) => {
  const since = new Date(Date.now() - 21 * 86_400_000);
  const listings = await prisma.listing.findMany({ where: { reportedAt: { gte: since } }, include: { seller: true }, orderBy: { reportedAt: "desc" } });
  const latest = new Map<string, (typeof listings)[number]>();
  for (const l of listings) { const k = `${l.sellerId}:${l.product}`; if (!latest.has(k)) latest.set(k, l); }
  const current = [...latest.values()].map((l) => ({ listingId: l.id, sellerId: l.sellerId, sellerName: l.seller.name, bazaar: l.seller.bazaar, product: l.product, region: l.seller.province, pricePerKg: l.pricePerKg, reportedAt: l.reportedAt }));
  res.json({ method: "z-score > 2 within product × region, groups of ≥ 4", scanned: current.length, anomalies: explainAnomalies(current) });
});

/** Bazaar-admin dashboard data: anomalies, trends, reliability leaderboard, personalisation demo. */
app.get("/admin/overview", async (req, res) => {
  const province = (req.query.province as string) || "toshkent-shahri";
  const since = new Date(Date.now() - 21 * 86_400_000);
  const listings = await prisma.listing.findMany({ where: { reportedAt: { gte: since } }, include: { seller: true }, orderBy: { reportedAt: "desc" } });
  const latest = new Map<string, (typeof listings)[number]>();
  for (const l of listings) { const k = `${l.sellerId}:${l.product}`; if (!latest.has(k)) latest.set(k, l); }
  const current = [...latest.values()].map((l) => ({ listingId: l.id, sellerId: l.sellerId, sellerName: l.seller.name, bazaar: l.seller.bazaar, product: l.product, region: l.seller.province, pricePerKg: l.pricePerKg, reportedAt: l.reportedAt }));

  const productsHere = [...new Set(current.filter((c) => c.region === province).map((c) => c.product))];
  const trends = await Promise.all(productsHere.map(async (product) => ({ product, region: province, ...(await forecastTrend(product, province)) })));

  const sellers = await prisma.seller.findMany({ orderBy: { name: "asc" } });
  const rel = await computeReliabilityBulk(sellers.map((s) => s.id));
  const reliability = sellers.map((s) => ({ sellerId: s.id, name: s.name, bazaar: s.bazaar, province: s.province, ...rel.get(s.id)! })).sort((a, b) => b.score - a.score);

  const demo = await Promise.all(["demo-cheap", "demo-quality", "anon"].map(async (id) => {
    const p = await getPersonalWeights(id);
    const r = await recommend({ product: "tomato", province, personalWeights: p.preference ? p.weights : undefined, maxResults: 3 });
    return { buyer: id, preference: p.preference, weights: r.weights, top: r.results.map((x) => ({ sellerName: x.sellerName, score: x.score, pricePerKg: x.pricePerKg, rating: x.rating })) };
  }));

  res.json({
    province,
    anomalies: { method: "z-score > 2 within product × region, groups of ≥ 4", items: explainAnomalies(current) },
    trends: { method: `least-squares line over ${FORECAST_WINDOW_DAYS} days of reports`, items: trends },
    reliability,
    personalization: { method: "rank of contacted listings vs. what was on offer → nudge weights ±0.15", product: "tomato", items: demo },
    gate: { minReliability: 20, staleAfterHours: 48 },
  });
});

/** Basket quote (Enterprise). Accepts `items` or free `text`. */
app.post("/quote", async (req, res) => {
  try {
    const { text, items: rawItems, province, region, lat, lng } = req.body ?? {};
    let items = Array.isArray(rawItems) ? rawItems : [];
    let unknown: string[] = [];
    if (typeof text === "string") ({ items, unknown } = parseBasket(text));
    if (!items.length) return res.status(400).json({ error: "no recognisable items", unknown });
    const quote = await quoteBasket({ items, province, region, lat, lng });
    res.json({ ...quote, unknown });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "internal error" });
  }
});

// Serve the Mini App from the same origin, so one HTTPS tunnel exposes both API and app.
const miniappDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../miniapp");
app.use("/app", express.static(miniappDir, { extensions: ["html"] }));
app.get("/", (_req, res) => res.redirect("/app/"));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`bozorchi-ai backend listening on http://localhost:${port}  (mini app at /app/)`);
});
