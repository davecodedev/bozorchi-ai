import "dotenv/config";
import express, { type Request, type Response } from "express";
import { getOrCreateBuyer, identify } from "./auth.js";
import { parseBasket, quoteBasket } from "./basket.js";
import { forecast, sampleSeries } from "./history.js";
import { consumeSearch, CREDIT_PACK_SIZE, hasFeature, MAX_RESULTS, usageOf, type Tier } from "./limits.js";
import { nlpAvailable, parseQuery, toKg } from "./nlp.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES } from "./geo.js";
import { CATEGORIES, PRODUCTS, resolveProduct } from "./products.js";
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
  res.json({ buyer: { id: b.id, telegramUserId: b.telegramUserId, name: b.name, username: b.username, tier: b.tier, upgradedAt: b.upgradedAt }, usage: usageOf(b) });
});

/** Fake checkout for the demo — flips the tier. Real Telegram Payments/Stars plug in here later. */
app.post("/me/upgrade", async (req, res) => {
  const b = await buyerOf(req);
  const tier: Tier = req.body?.tier === "standard" ? "standard" : "enterprise";
  const u = await prisma.buyer.update({ where: { id: b.id }, data: { tier, upgradedAt: tier === "enterprise" ? new Date() : null } });
  res.json({ ok: true, tier: u.tier, usage: usageOf(u) });
});

app.post("/me/credits", async (req, res) => {
  const b = await buyerOf(req);
  const u = await prisma.buyer.update({ where: { id: b.id }, data: { credits: b.credits + CREDIT_PACK_SIZE } });
  res.json({ ok: true, added: CREDIT_PACK_SIZE, usage: usageOf(u) });
});

const paywall = (res: Response, feature: string, usage: ReturnType<typeof usageOf>) =>
  res.status(403).json({ error: "enterprise_required", feature, usage });

/** Everything the Mini App needs to draw its chips. */
app.get("/meta", (_req, res) =>
  res.json({
    products: PRODUCTS.map(({ key, category, label }) => ({ key, category, label })),
    categories: CATEGORIES,
    provinces: PROVINCES.map(({ key, label }) => ({ key, label })),
    defaultWeights: DEFAULT_WEIGHTS,
  }),
);

app.get("/products", (_req, res) => res.json({ products: PRODUCTS, defaultWeights: DEFAULT_WEIGHTS }));

app.get("/sellers", async (req, res) => {
  try {
    const { province, category, q } = req.query as Record<string, string | undefined>;
    res.json({ sellers: await listSellers({ province, category: category as never, q }) });
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
  res.json({ seller });
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
    const b = await buyerOf(req);
    const tier = (b.tier === "enterprise" ? "enterprise" : "standard") as Tier;
    const data = await recommend({ ...(req.body ?? {}), maxResults: MAX_RESULTS[tier], allowWeights: hasFeature(b, "weights") });
    // Only successful searches cost quota.
    const usage = await consumeSearch(b);
    if (!usage) return res.status(402).json({ error: "limit_reached", usage: usageOf(b) });
    res.json({ ...data, usage });
  } catch (e) {
    if (e instanceof RecommendError) {
      return res.status(e.status).json({ error: e.message, ...(e.extra as object) });
    }
    console.error(e);
    res.status(500).json({ error: "internal error" });
  }
});

/** 30-day series (all tiers) + 7-day forecast (Enterprise). */
app.get("/history/:sellerId/:product", async (req, res) => {
  const b = await buyerOf(req);
  const sellerId = Number(req.params.sellerId);
  const seller = Number.isInteger(sellerId) ? await getSeller(sellerId) : null;
  const listing = seller?.products.find((p) => p.product === req.params.product);
  if (!seller || !listing) return res.status(404).json({ error: "listing not found" });
  const series = sampleSeries(listing.pricePerKg, `${seller.id}:${listing.product}`);
  const first = series[0], last = series[series.length - 1];
  const body: Record<string, unknown> = {
    sellerId: seller.id, sellerName: seller.name, bazaar: seller.bazaar, province: seller.province, product: listing.product,
    series, current: last, changePct: Math.round(((last - first) / first) * 100), sample: true,
  };
  if (hasFeature(b, "forecast")) body.forecast = forecast(series);
  else body.forecastLocked = true;
  res.json(body);
});

/** Basket quote (Enterprise). Accepts `items` or free `text`. */
app.post("/quote", async (req, res) => {
  try {
    const b = await buyerOf(req);
    if (!hasFeature(b, "basket")) return paywall(res, "basket", usageOf(b));
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
