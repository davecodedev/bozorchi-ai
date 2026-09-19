import { test } from "node:test";
import assert from "node:assert/strict";
import { inferPersonalWeights, DEFAULT_WEIGHTS, rankCandidates, type Candidate } from "./scoring.ts";

test("buyer who always contacts the cheapest → price weight nudged up, others down, still sums to 1", () => {
  const { weights, preference } = inferPersonalWeights([
    { priceRank: 0, qualityRank: 0.8 }, { priceRank: 0.1, qualityRank: 0.6 }, { priceRank: 0, qualityRank: 0.9 }, { priceRank: 0.05, qualityRank: 0.7 },
  ]);
  assert.equal(preference, "price");
  assert.equal(weights.price, 0.6);
  assert.ok(weights.quality < DEFAULT_WEIGHTS.quality && weights.distance < DEFAULT_WEIGHTS.distance);
  assert.ok(Math.abs(weights.price + weights.quality + weights.distance - 1) < 0.02);
});

test("buyer who always contacts the highest-rated → quality nudged up", () => {
  const { weights, preference } = inferPersonalWeights([
    { priceRank: 0.9, qualityRank: 0 }, { priceRank: 0.7, qualityRank: 0.05 }, { priceRank: 1, qualityRank: 0 },
  ]);
  assert.equal(preference, "quality");
  assert.equal(weights.quality, 0.5);
});

test("fewer than 3 contacts, or no clear pattern → default weights", () => {
  assert.deepEqual(inferPersonalWeights([]).weights, DEFAULT_WEIGHTS);
  assert.deepEqual(inferPersonalWeights([{ priceRank: 0, qualityRank: 1 }, { priceRank: 0, qualityRank: 1 }]).weights, DEFAULT_WEIGHTS);
  assert.deepEqual(inferPersonalWeights([{ priceRank: 0.5, qualityRank: 0.5 }, { priceRank: 0.4, qualityRank: 0.5 }, { priceRank: 0.5, qualityRank: 0.45 }]).weights, DEFAULT_WEIGHTS);
});

test("the two seeded habits produce different top picks on the same candidates", () => {
  const base = { bazaar: "", region: "", reviewCount: 10, reportedAt: new Date() };
  const c: Candidate[] = [
    { ...base, listingId: 1, sellerId: 1, sellerName: "Cheap", verified: false, rating: 4.2, pricePerKg: 12_000, distanceKm: 9 },
    { ...base, listingId: 2, sellerId: 2, sellerName: "Premium", verified: true, rating: 4.8, pricePerKg: 19_000, distanceKm: 2 },
    { ...base, listingId: 3, sellerId: 3, sellerName: "Mid", verified: true, rating: 4.3, pricePerKg: 15_000, distanceKm: 5 },
  ];
  const cheap = inferPersonalWeights([{ priceRank: 0, qualityRank: 1 }, { priceRank: 0, qualityRank: 0.9 }, { priceRank: 0.1, qualityRank: 1 }]).weights;
  const quality = inferPersonalWeights([{ priceRank: 1, qualityRank: 0 }, { priceRank: 0.9, qualityRank: 0 }, { priceRank: 1, qualityRank: 0.1 }]).weights;
  assert.equal(rankCandidates(c)[0].sellerName, "Mid"); // default weights: the balanced option
  assert.equal(rankCandidates(c, { weights: cheap })[0].sellerName, "Cheap");
  assert.equal(rankCandidates(c, { weights: quality })[0].sellerName, "Premium");
});
