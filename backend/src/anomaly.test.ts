import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies, explainAnomalies } from "./anomaly.ts";

const L = (product: string, region: string, pricePerKg: number, id = 0) => ({ id, product, region, pricePerKg });

test("an absurd price among normal variation is flagged; the normal spread is not", () => {
  const listings = [
    L("tomato", "t", 12_000, 1), L("tomato", "t", 13_000, 2), L("tomato", "t", 13_800, 3), L("tomato", "t", 14_000, 4),
    L("tomato", "t", 14_500, 5), L("tomato", "t", 15_500, 6), L("tomato", "t", 17_000, 7), L("tomato", "t", 19_000, 8),
    L("tomato", "t", 38_000, 9), // typo
  ];
  const flagged = detectAnomalies(listings);
  assert.deepEqual(flagged.map((l) => l.id), [9]);
  const [a] = explainAnomalies(listings);
  assert.ok(a.zScore > 2, `z=${a.zScore}`);
  assert.equal(a.groupSize, 9);
});

test("groups with fewer than 4 listings are skipped even with a wild value", () => {
  assert.deepEqual(detectAnomalies([L("apple", "s", 10_000), L("apple", "s", 11_000), L("apple", "s", 90_000)]), []);
});

test("groups are per product AND region — a Xorazm price never competes with Tashkent", () => {
  const listings = [
    L("onion", "toshkent-shahri", 4_100, 1), L("onion", "toshkent-shahri", 4_500, 2), L("onion", "toshkent-shahri", 4_800, 3), L("onion", "toshkent-shahri", 6_200, 4),
    L("onion", "xorazm", 3_300, 5),
  ];
  assert.deepEqual(detectAnomalies(listings), []);
});

test("identical prices → no anomalies, no division by zero", () => {
  assert.deepEqual(detectAnomalies([L("a", "r", 5), L("a", "r", 5), L("a", "r", 5), L("a", "r", 5)]), []);
});

test("both directions are flagged (suspiciously cheap too)", () => {
  const listings = [L("a", "r", 100, 1), L("a", "r", 102, 2), L("a", "r", 98, 3), L("a", "r", 101, 4), L("a", "r", 99, 5), L("a", "r", 10, 6)];
  assert.deepEqual(detectAnomalies(listings).map((l) => l.id), [6]);
});
