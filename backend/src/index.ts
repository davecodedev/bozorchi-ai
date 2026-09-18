import "dotenv/config";
import express from "express";
import { PRODUCTS } from "./products.js";
import { recommend, RecommendError } from "./recommend.js";
import { DEFAULT_WEIGHTS } from "./scoring.js";

const app = express();
app.use(express.json());

// Mini App will be served from a different origin (Telegram) — allow it.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "bazarcha-backend" }));

app.get("/products", (_req, res) => res.json({ products: PRODUCTS, defaultWeights: DEFAULT_WEIGHTS }));

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

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`bazarcha backend listening on http://localhost:${port}`);
});
