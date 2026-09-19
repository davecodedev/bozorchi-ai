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
import { hotFeed } from "./feed.js";
import { photoFor } from "./photos.js";
import { transcribeAudio, transcribeAvailable } from "./transcribe.js";
import { sellerDashboard, WINDOWS } from "./dashboard.js";
import { runAssistant } from "./assistant.js";
import { verifyListing } from "./verify.js";
import { logEvent } from "./events.js";
import { getSettings } from "./settings.js";
import { adminCatalog, adminAuth, adminDeals, adminEvents, adminListings, adminSellers, adminStats, adminUpdateUser, adminUsers, DEFAULT_SETTINGS, setSetting } from "./admin.js";
import { BannedError } from "./auth.js";
import { createOwnListing, deleteOwnListing, ListingError, ownListingFor, updateOwnListing } from "./listings.js";
import { COMMISSION_BRACKETS } from "./commission.js";
import { geminiStatus } from "./gemini.js";
import { GEMINI_MODELS, selectProviderName } from "./nlp.js";
import { TRANSCRIBE_MODELS } from "./transcribe.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES } from "./geo.js";
import { CATEGORIES, PRODUCTS, resolveProduct, UNIT_LABEL } from "./products.js";
import { prisma } from "./db.js";
import { recommend, RecommendError } from "./recommend.js";
import { DEFAULT_WEIGHTS } from "./scoring.js";
import { getSeller, listSellers } from "./sellers.js";

const app = express();
app.use(express.json({ limit: "6mb" })); // listing photos arrive as data URLs
app.use("/transcribe", express.raw({ type: ["audio/*", "video/*", "application/octet-stream"], limit: "8mb" }));

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
// banned buyers: turn BannedError into a 403 for every route
app.use(async (req, res, next) => { try { if (/^\/(me|recommend|sellers|deals|quote|assistant|history|market|feed|parse)/.test(req.path)) await buyerOf(req); next(); } catch (e) { if (e instanceof BannedError) return res.status(403).json({ error: "account suspended" }); next(); } });

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
  logEvent("upgrade", { buyerId: b.id, meta: { tier } });
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
    logEvent("unlock", { buyerId: b.id, sellerId: id, meta: { status: r.status } });
    res.status(r.status === "quota_exceeded" ? 402 : 200).json(r);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

/** Everything the Mini App needs to draw its chips. */
app.get("/meta", async (_req, res) =>
  res.json({
    settings: (({ features, announcement, fees, commissionEnabled }) => ({ features, announcement, fees, commissionEnabled }))(await getSettings()),
    commission: { brackets: COMMISSION_BRACKETS.map((b) => ({ upTo: Number.isFinite(b.upTo) ? b.upTo : null, rate: b.rate })), split: 0.5 },
    products: PRODUCTS.map(({ key, category, unit, label, aliases }) => ({ key, category, unit, label, aliases, photoUrl: photoFor(key) })),
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
  logEvent("parse", { meta: { text: text.slice(0, 120), product: parsed.product } });
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
    (data as Record<string, unknown>).own = await ownListingFor(b, data.product); // the buyer's own post for this product, if any
    logEvent("search", { buyerId: b.id, meta: { product: data.product, province: data.province, candidates: data.candidates } });
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
  if (!(await getSettings()).features.deals) return res.status(403).json({ error: "deals are disabled by admin" });
  try {
    const b = await buyerOf(req);
    const d = await createDeal(b.telegramUserId, req.body ?? {});
    logEvent("deal_created", { buyerId: b.id, sellerId: d.sellerId, meta: { deal: d.id, product: d.listing.product, quantity: d.quantity, offer: d.initialOffer } });
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
    const d = await counterDeal(req.params.id, req.body?.pricePerKg);
    logEvent("deal_countered", { buyerId: d.buyerId, sellerId: d.sellerId, meta: { deal: d.id, counter: d.counterOffer } });
    res.json({ deal: presentDeal(d, "buyer") });
  } catch (e) { dealErr(res, e); }
});
app.post("/deals/:id/accept", async (req, res) => {
  try {
    const { actor } = await actorFor(req, req.params.id);
    const d = await acceptDeal(req.params.id, actor);
    logEvent("deal_accepted", { buyerId: d.buyerId, sellerId: d.sellerId, meta: { deal: d.id, total: d.totalValue, commission: d.commissionAmt } });
    res.json({ deal: presentDeal(d, "buyer") });
  } catch (e) { dealErr(res, e); }
});
app.post("/deals/:id/decline", async (req, res) => {
  try {
    const { actor } = await actorFor(req, req.params.id);
    const d = await declineDeal(req.params.id, actor);
    logEvent("deal_declined", { buyerId: d.buyerId, sellerId: d.sellerId, meta: { deal: d.id, by: actor } });
    res.json({ deal: presentDeal(d, "buyer") });
  } catch (e) { dealErr(res, e); }
});

/** AI verification of a listing before it is posted (photo ↔ name, category, price sanity, inappropriate content). */
// ---------------------------------------------------------------- listings posted from the app ("+" button)
app.post("/listings", async (req, res) => {
  try {
    const b = await buyerOf(req);
    const r = await createOwnListing(b, req.body ?? {});
    logEvent("listing_created", { buyerId: b.id, sellerId: r.seller.id, meta: { listing: r.listing.id, product: r.product, price: r.listing.pricePerKg } });
    res.status(201).json({ listingId: r.listing.id, sellerId: r.seller.id, product: r.product, inCatalog: Boolean(r.catalogKey) });
  } catch (e) { if (e instanceof ListingError) return res.status(e.status).json({ error: e.message }); console.error(e); res.status(500).json({ error: "internal error" }); }
});
app.patch("/listings/:id", async (req, res) => {
  try {
    const b = await buyerOf(req);
    const r = await updateOwnListing(b, Number(req.params.id), req.body ?? {});
    res.json({ listingId: r.listing.id, product: r.product, inCatalog: Boolean(r.catalogKey) });
  } catch (e) { if (e instanceof ListingError) return res.status(e.status).json({ error: e.message }); console.error(e); res.status(500).json({ error: "internal error" }); }
});
app.delete("/listings/:id", async (req, res) => {
  try { await deleteOwnListing(await buyerOf(req), Number(req.params.id)); res.json({ ok: true }); }
  catch (e) { if (e instanceof ListingError) return res.status(e.status).json({ error: e.message }); console.error(e); res.status(500).json({ error: "internal error" }); }
});

app.post("/listings/verify", async (req, res) => {
  if (!(await getSettings()).features.verification) return res.json({ ok: true, issues: [], detected: {}, aiChecked: false, skipped: "disabled by admin" });
  try { const v = await verifyListing(req.body ?? {}); logEvent("verify", { meta: { name: req.body?.name, ok: v.ok, issues: v.issues.map((i) => i.code) } }); res.json(v); }
  catch (e) { console.error(e); res.status(500).json({ error: "internal error" }); }
});

/** AI assistant: multi-item request + preferences → per-item picks, basket quote and a spoken answer. */
app.post("/assistant", async (req, res) => {
  if (!(await getSettings()).features.assistant) return res.status(403).json({ error: "assistant disabled by admin" });
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "text is required" });
    const b = await buyerOf(req);
    const personal = await getPersonalWeights(b.telegramUserId);
    const { province, region, lat, lng } = req.body ?? {};
    const out = await runAssistant({ text, province, region, lat, lng, personalWeights: personal.preference ? personal.weights : undefined });
    logEvent("assistant", { buyerId: b.id, meta: { text: text.slice(0, 120), items: out.items.length, priority: out.plan.priority } });
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: "internal error" }); }
});

/** Voice → text via Gemini audio. Body = raw audio bytes (content-type = the recording's mime type). */
app.get("/transcribe", async (_req, res) => res.json({ available: transcribeAvailable() && (await getSettings()).features.voice }));
app.post("/transcribe", async (req, res) => {
  if (!(await getSettings()).features.voice) return res.status(403).json({ error: "voice disabled by admin", available: false });
  if (!transcribeAvailable()) return res.status(503).json({ error: "speech recognition not configured", available: false });
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length < 500) return res.status(400).json({ error: "no audio" });
  try {
    const mime = (req.header("content-type") || "audio/webm").split(";")[0];
    const text = await transcribeAudio(buf, mime);
    logEvent("transcribe", { meta: { bytes: buf.length, chars: text.length } });
    res.json({ text, available: true });
  } catch (e) {
    console.error("transcribe failed:", e);
    res.status(502).json({ error: "transcription failed" });
  }
});

/** Seller dashboard: sales, revenue, commission, net and vs-list gain/loss over a window (12h | 24h | 7d | 30d). */
app.get("/sellers/:id/dashboard", async (req, res) => {
  const id = Number(req.params.id);
  const w = String(req.query.window || "7d");
  if (!Number.isInteger(id) || !WINDOWS[w]) return res.status(400).json({ error: "bad id or window" });
  const d = await sellerDashboard(id, w);
  if (!d) return res.status(404).json({ error: "seller not found" });
  res.json(d);
});

/** Hot-sales feed: best-priced fresh listings across products (For-You style, paginated). */
app.get("/feed", async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    res.json(await hotFeed({ province: q.province ?? null, category: q.category ?? null, offset: Number(q.offset) || 0, limit: Number(q.limit) || 20, lat: q.lat ? Number(q.lat) : undefined, lng: q.lng ? Number(q.lng) : undefined }));
  } catch (e) { console.error(e); res.status(500).json({ error: "internal error" }); }
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

// ---------------------------------------------------------------- platform admin (separate site at /admin/)
app.use("/admin/api", adminAuth);
app.get("/admin/api/stats", async (req, res) => { try { res.json(await adminStats(String(req.query.window || "7d"))); } catch (e) { console.error(e); res.status(500).json({ error: "internal error" }); } });
app.get("/admin/api/users", async (req, res) => res.json(await adminUsers({ search: req.query.q as string, tier: req.query.tier as string, page: Number(req.query.page) || 1 })));
app.post("/admin/api/users/:id", async (req, res) => { try { res.json({ user: await adminUpdateUser(Number(req.params.id), req.body ?? {}) }); } catch (e) { res.status(400).json({ error: (e as Error).message }); } });
app.get("/admin/api/sellers", async (req, res) => res.json(await adminSellers({ search: req.query.q as string, province: req.query.province as string, page: Number(req.query.page) || 1, suspended: req.query.suspended === "1" ? true : req.query.suspended === "0" ? false : undefined })));
app.post("/admin/api/sellers/:id", async (req, res) => { try { res.json({ seller: await prisma.seller.update({ where: { id: Number(req.params.id) }, data: { ...(typeof req.body?.suspended === "boolean" ? { suspended: req.body.suspended } : {}), ...(typeof req.body?.verified === "boolean" ? { verified: req.body.verified } : {}) } }) }); } catch (e) { res.status(400).json({ error: (e as Error).message }); } });
app.get("/admin/api/listings", async (req, res) => res.json(await adminListings({ search: req.query.q as string, product: req.query.product as string, page: Number(req.query.page) || 1 })));
app.delete("/admin/api/listings/:id", async (req, res) => { try { const id = Number(req.params.id); await prisma.buyerInteraction.deleteMany({ where: { listingId: id } }); await prisma.deal.deleteMany({ where: { listingId: id } }); await prisma.listing.delete({ where: { id } }); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: (e as Error).message }); } });
app.get("/admin/api/deals", async (req, res) => res.json(await adminDeals({ status: req.query.status as string, page: Number(req.query.page) || 1 })));
app.get("/admin/api/events", async (req, res) => res.json({ events: await adminEvents({ type: req.query.type as string, limit: Number(req.query.limit) || 100 }) }));
app.get("/admin/api/settings", async (_req, res) => res.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS }));
app.post("/admin/api/settings", async (req, res) => {
  try {
    const patch = req.body ?? {};
    for (const key of ["tiers", "features", "commissionEnabled", "announcement", "fees"] as const) if (key in patch) await setSetting(key, patch[key]);
    res.json({ settings: await getSettings() });
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});
app.get("/admin/api/products", (_req, res) => res.json(adminCatalog()));
app.get("/admin/api/ai", (_req, res) => res.json({ provider: selectProviderName(), ...geminiStatus({ nlp: GEMINI_MODELS, transcribe: TRANSCRIBE_MODELS }) }));
app.post("/admin/api/ai/selftest", async (req, res) => {
  const text = String(req.body?.text || "500 kg pomidor Chilonzorga kerak");
  const t0 = Date.now();
  const parsed = await parseQuery(text);
  const status = geminiStatus({ nlp: GEMINI_MODELS, transcribe: TRANSCRIBE_MODELS });
  const ok = Boolean(parsed.product);
  res.json({ ok, text, parsed, ms: Date.now() - t0, model: ok ? status.lastSuccess.nlp?.model ?? null : null, models: status.models });
});
const adminDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../admin");
app.use("/admin", express.static(adminDir, { extensions: ["html"] }));

// Serve the Mini App from the same origin, so one HTTPS tunnel exposes both API and app.
const miniappDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../miniapp");
app.use("/app", express.static(miniappDir, { extensions: ["html"] }));
app.get("/", (_req, res) => res.redirect("/app/"));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`bozorchi-ai backend listening on http://localhost:${port}  (mini app at /app/)`);
});
