import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rankCandidates,
  normalizeScore,
  resolveWeights,
  DEFAULT_WEIGHTS,
  VERIFIED_BONUS,
  type Candidate,
} from "./scoring.ts";

const base = {
  bazaar: "Test Bazaar",
  region: "Chilanzar",
  reviewCount: 10,
  reportedAt: new Date("2026-09-18T00:00:00Z"),
};

/** Small hand-built fixture where the ranking is easy to verify by hand. */
const fixture: Candidate[] = [
  // Cheapest, mediocre quality, far away
  { ...base, listingId: 1, sellerId: 1, sellerName: "Cheap Far", verified: false, rating: 3.5, pricePerKg: 10_000, distanceKm: 12 },
  // Most expensive, best quality, closest
  { ...base, listingId: 2, sellerId: 2, sellerName: "Premium Near", verified: true, rating: 4.8, pricePerKg: 14_000, distanceKm: 2 },
  // Middle on everything
  { ...base, listingId: 3, sellerId: 3, sellerName: "Balanced", verified: true, rating: 4.2, pricePerKg: 12_000, distanceKm: 7 },
  // Expensive AND bad AND far — must come last
  { ...base, listingId: 4, sellerId: 4, sellerName: "Worst", verified: false, rating: 2.5, pricePerKg: 14_000, distanceKm: 12 },
];

test("normalizeScore: min-max to 0–100, flips when lower is better", () => {
  assert.equal(normalizeScore(10, 10, 20, true), 100);
  assert.equal(normalizeScore(20, 10, 20, true), 0);
  assert.equal(normalizeScore(15, 10, 20, true), 50);
  assert.equal(normalizeScore(20, 10, 20, false), 100);
  assert.equal(normalizeScore(10, 10, 20, false), 0);
});

test("normalizeScore: identical values → everyone gets 100 (no differentiation)", () => {
  assert.equal(normalizeScore(5, 5, 5, true), 100);
  assert.equal(normalizeScore(5, 5, 5, false), 100);
});

test("default weights are 0.45 / 0.35 / 0.20 and sum to 1", () => {
  assert.equal(DEFAULT_WEIGHTS.price, 0.45);
  assert.equal(DEFAULT_WEIGHTS.quality, 0.35);
  assert.equal(DEFAULT_WEIGHTS.distance, 0.2);
  const w = resolveWeights();
  assert.ok(Math.abs(w.price + w.quality + w.distance - 1) < 1e-9);
});

test("resolveWeights: normalises arbitrary ratios and rejects bad input", () => {
  const w = resolveWeights({ price: 2, quality: 1, distance: 1 });
  assert.equal(w.price, 0.5);
  assert.equal(w.quality, 0.25);
  assert.equal(w.distance, 0.25);
  assert.throws(() => resolveWeights({ price: -1 }));
  assert.throws(() => resolveWeights({ price: 0, quality: 0, distance: 0 }));
  // partial override keeps the other defaults
  const p = resolveWeights({ price: 0.45 });
  assert.equal(p.quality, 0.35);
});

test("rankCandidates: per-candidate breakdown is exactly the documented formula", () => {
  const ranked = rankCandidates(fixture, { limit: 10 });
  const byName = Object.fromEntries(ranked.map((r) => [r.sellerName, r]));

  // Cheap Far: price 100 (cheapest), quality raw 3.5 → (3.5-2.5)/(5.3-2.5)=35.7, distance 0 (farthest)
  const cf = byName["Cheap Far"];
  assert.equal(cf.breakdown.priceScore, 100);
  assert.equal(cf.breakdown.distanceScore, 0);
  assert.equal(cf.breakdown.qualityRaw, 3.5);
  assert.equal(cf.breakdown.qualityScore, 35.7);
  assert.equal(cf.score, Math.round((0.45 * 100 + 0.35 * (1 / 2.8) * 100 + 0) * 10) / 10);

  // Premium Near: price 0 (most expensive), quality 100 (4.8 + 0.5 bonus = 5.3 max), distance 100
  const pn = byName["Premium Near"];
  assert.equal(pn.breakdown.priceScore, 0);
  assert.equal(pn.breakdown.qualityRaw, 4.8 + VERIFIED_BONUS);
  assert.equal(pn.breakdown.qualityScore, 100);
  assert.equal(pn.breakdown.distanceScore, 100);
  assert.equal(pn.score, 55); // 0 + 35 + 20

  // Worst: 0 on everything
  assert.equal(byName["Worst"].score, 0);
});

test("rankCandidates: sorts descending, assigns ranks, returns top 3 by default", () => {
  const top = rankCandidates(fixture);
  assert.equal(top.length, 3);
  assert.deepEqual(
    top.map((r) => r.sellerName),
    ["Balanced", "Cheap Far", "Premium Near"],
  );
  assert.deepEqual(top.map((r) => r.rank), [1, 2, 3]);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
  assert.ok(!top.some((r) => r.sellerName === "Worst"));
});

test("rankCandidates: weights change the winner", () => {
  // All-in on price → the cheapest seller wins
  const cheapest = rankCandidates(fixture, { weights: { price: 1, quality: 0, distance: 0 } });
  assert.equal(cheapest[0].sellerName, "Cheap Far");

  // All-in on quality → the verified top-rated seller wins
  const best = rankCandidates(fixture, { weights: { price: 0, quality: 1, distance: 0 } });
  assert.equal(best[0].sellerName, "Premium Near");

  // All-in on distance → the closest seller wins
  const nearest = rankCandidates(fixture, { weights: { price: 0, quality: 0, distance: 1 } });
  assert.equal(nearest[0].sellerName, "Premium Near");
});

test("rankCandidates: verified bonus breaks a rating tie in favour of the verified seller", () => {
  const a: Candidate = { ...base, listingId: 1, sellerId: 1, sellerName: "Unverified", verified: false, rating: 4.0, pricePerKg: 10_000, distanceKm: 5 };
  const b: Candidate = { ...base, listingId: 2, sellerId: 2, sellerName: "Verified", verified: true, rating: 4.0, pricePerKg: 10_000, distanceKm: 5 };
  const ranked = rankCandidates([a, b]);
  assert.equal(ranked[0].sellerName, "Verified");
  assert.equal(ranked[0].breakdown.qualityScore, 100);
  assert.equal(ranked[1].breakdown.qualityScore, 0);
});

test("rankCandidates: edge cases — empty input, single candidate, fewer than 3", () => {
  assert.deepEqual(rankCandidates([]), []);

  const one = rankCandidates([fixture[0]]);
  assert.equal(one.length, 1);
  assert.equal(one[0].score, 100); // alone in the set → 100 on every axis
  assert.equal(one[0].rank, 1);

  const two = rankCandidates(fixture.slice(0, 2));
  assert.equal(two.length, 2);
});

test("rankCandidates: does not mutate its input", () => {
  const copy = fixture.map((c) => ({ ...c }));
  rankCandidates(fixture);
  assert.deepEqual(fixture, copy);
});
