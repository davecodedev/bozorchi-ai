import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveQuery } from "./bot.ts";
import type { ParsedQuery } from "./api.ts";

const p = (o: Partial<ParsedQuery>): ParsedQuery => ({ available: true, product: null, quantity: null, unit: null, region: null, productKey: null, quantityKg: null, ...o });

test("parser unavailable → legacy path: raw text + keyword district", () => {
  const r = resolveQuery("pomidor Chilonzor", p({ available: false }), undefined);
  assert.deepEqual(r, { product: "pomidor Chilonzor", quantityKg: undefined, region: "Chilanzar" });
});

test("parser found nothing → product null so the bot asks", () => {
  assert.equal(resolveQuery("asdkjh", p({}), "Chilanzar").product, null);
});

test("full parse → canonical key, kg, district from the parsed region", () => {
  const r = resolveQuery("500 kg pomidor kerak, Chilonzor", p({ product: "pomidor", productKey: "tomato", quantity: 500, unit: "kg", quantityKg: 500, region: "Chilonzor" }));
  assert.deepEqual(r, { product: "tomato", quantityKg: 500, region: "Chilanzar" });
});

test("LLM returned nothing but keyword fallback found a product → use it", () => {
  const r = resolveQuery("kartoshka yunusobod", p({ productKey: "potato" }), undefined);
  assert.deepEqual(r, { product: "potato", quantityKg: undefined, region: "Yunusabad" });
});

test("unknown product name is passed through so /recommend can 404 with a helpful message", () => {
  assert.equal(resolveQuery("banan", p({ product: "banan" })).product, "banan");
});

test("region fallbacks: parsed province we don't map → raw text → last region", () => {
  assert.equal(resolveQuery("piyoz kerak", p({ product: "piyoz", productKey: "onion", region: "Toshkent" }), "Yunusabad").region, "Yunusabad");
  assert.equal(resolveQuery("piyoz kerak yunusobod", p({ product: "piyoz", productKey: "onion" }), "Chilanzar").region, "Yunusabad");
  assert.equal(resolveQuery("piyoz kerak", p({ product: "piyoz", productKey: "onion" })).region, undefined);
});
