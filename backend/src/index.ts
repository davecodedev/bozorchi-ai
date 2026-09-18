import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES } from "./geo.js";
import { CATEGORIES, PRODUCTS } from "./products.js";
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

app.get("/health", (_req, res) => res.json({ ok: true, service: "bazarcha-backend" }));

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

app.post("/recommend", async (req, res) => {
  try {
    res.json(await recommend(req.body ?? {}));
  } catch (e) {
    if (e instanceof RecommendError) {
      return res.status(e.status).json({ error: e.message, ...(e.extra as object) });
    }
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
  console.log(`bazarcha backend listening on http://localhost:${port}  (mini app at /app/)`);
});
