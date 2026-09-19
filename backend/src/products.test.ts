import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS, CATEGORIES, resolveProduct } from "./products.ts";

test("catalog: 50+ products, every category used, keys unique", () => {
  assert.ok(PRODUCTS.length >= 50, `only ${PRODUCTS.length} products`);
  assert.equal(new Set(PRODUCTS.map((p) => p.key)).size, PRODUCTS.length);
  for (const c of CATEGORIES) assert.ok(PRODUCTS.some((p) => p.category === c.key), `no products in ${c.key}`);
});

test("exact and contained aliases across languages", () => {
  assert.equal(resolveProduct("Pomidor"), "tomato");
  assert.equal(resolveProduct("2 tonna картошка kerak"), "potato");
  assert.equal(resolveProduct("sement 20 qop"), "cement");
  assert.equal(resolveProduct("зарядка для телефона"), "charger");
  assert.equal(resolveProduct("mol go'shti"), "beef");
});

test("fuzzy: one or two typos still resolve; junk does not", () => {
  assert.equal(resolveProduct("kartoshkaa"), "potato");
  assert.equal(resolveProduct("pomidr"), "tomato");
  assert.equal(resolveProduct("armaturra"), "rebar");
  assert.equal(resolveProduct("asdkjh qwe"), null);
  assert.equal(resolveProduct(""), null);
});
