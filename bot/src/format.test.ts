import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRecommendation, esc } from "./format.ts";
import { extractRegion } from "./region.ts";
import { pickLang, t } from "./i18n.ts";
import type { RecommendResponse } from "./api.ts";

const sample: RecommendResponse = {
  product: "tomato",
  label: { uz: "Pomidor", ru: "Помидор", en: "Tomato" },
  candidates: 10,
  results: [
    {
      rank: 1, score: 78.1, sellerId: 10, sellerName: "Chilonzor <Dehqon>", bazaar: "Chilonzor Bazaar",
      region: "Chilanzar", verified: true, rating: 4.3, reviewCount: 48, pricePerKg: 13800,
      distanceKm: 1.1, aiPick: true, reportedDaysAgo: 1,
      breakdown: { priceScore: 74.3, qualityScore: 70.6, distanceScore: 100 },
    },
    {
      rank: 2, score: 71.6, sellerId: 3, sellerName: "Farhod aka", bazaar: "Farhod Bazaar",
      region: "Chilanzar", verified: false, rating: 4.1, reviewCount: 22, pricePerKg: 12500,
      distanceKm: 1.4, aiPick: false, reportedDaysAgo: 0,
      breakdown: { priceScore: 92.9, qualityScore: 29.4, distanceScore: 97.5 },
    },
  ],
};

test("pickLang: ru/en detected, everything else falls back to uz", () => {
  assert.equal(pickLang("ru"), "ru");
  assert.equal(pickLang("en-GB"), "en");
  assert.equal(pickLang("uz"), "uz");
  assert.equal(pickLang(undefined), "uz");
  assert.equal(pickLang("de"), "uz");
});

test("extractRegion: Latin, Cyrillic and apostrophe variants", () => {
  assert.equal(extractRegion("pomidor Chilonzor"), "Chilanzar");
  assert.equal(extractRegion("помидор чиланзар"), "Chilanzar");
  assert.equal(extractRegion("piyoz qo'yliq"), "Bektemir");
  assert.equal(extractRegion("piyoz qo’yliq"), "Bektemir");
  assert.equal(extractRegion("kartoshka"), undefined);
});

test("formatRecommendation: escapes HTML, shows medals, badges and breakdown", () => {
  const out = formatRecommendation(sample, "uz", t("uz"), "Chilanzar");
  assert.match(out, /<b>Pomidor<\/b> — 10 ta/);
  assert.match(out, /🥇 <b>Chilonzor &lt;Dehqon&gt;<\/b>/);
  assert.match(out, /⭐ AI tanlovi · ✅ tasdiqlangan/);
  assert.match(out, /13 800<\/b> so'm\/kg/);
  assert.match(out, /narx 74 · sifat 71 · masofa 100 · kecha/);
  assert.match(out, /🥈 <b>Farhod aka<\/b>/);
  assert.doesNotMatch(out, /Farhod aka[\s\S]*?tasdiqlangan[\s\S]*?🧮/); // unverified → no badge
});

test("formatRecommendation: uses the requested language label", () => {
  const ru = formatRecommendation(sample, "ru", t("ru"), "Чиланзар");
  assert.match(ru, /<b>Помидор<\/b> — топ-3 из 10/);
  const en = formatRecommendation(sample, "en", t("en"), "Chilanzar");
  assert.match(en, /<b>Tomato<\/b> — top 3 of 10/);
});

test("formatRecommendation: empty results → friendly message", () => {
  const out = formatRecommendation({ ...sample, results: [] }, "uz", t("uz"), "Toshkent");
  assert.equal(out, t("uz").noResults);
});

test("esc: neutralises HTML special chars", () => {
  assert.equal(esc("a<b>&c"), "a&lt;b&gt;&amp;c");
});
