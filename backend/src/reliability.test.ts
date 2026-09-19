import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreReports, type Report } from "./reliability.ts";

const now = new Date("2026-09-19T12:00:00Z");
const h = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);
const daily = (days: number, price: (i: number) => number, lastAgoH = 2): Report[] =>
  Array.from({ length: days }, (_, i) => ({ product: "tomato", price: price(i), reportedAt: h(lastAgoH + i * 24) }));

test("frequent, varied, recent reporter → gold", () => {
  const r = scoreReports(daily(30, (i) => 13_000 + i * 50), now);
  assert.equal(r.recencyScore, 100);
  assert.equal(r.frequencyScore, 100);
  assert.ok(r.changeRatio >= 0.95);
  assert.equal(r.tier, "gold");
});

test("anti-farming: identical price ten times a day for 30 days is NOT gold despite perfect recency and frequency", () => {
  const reports: Report[] = [];
  for (let d = 0; d < 30; d++) for (let k = 0; k < 10; k++) reports.push({ product: "tomato", price: 12_000, reportedAt: h(2 + d * 24 + k) });
  const r = scoreReports(reports, now);
  assert.equal(r.recencyScore, 100);
  assert.equal(r.frequencyScore, 100);
  assert.ok(r.changeRatio < 0.05, `changeRatio=${r.changeRatio}`);
  assert.equal(r.score, 70);
  assert.equal(r.tier, "silver");
});

test("quiet seller: reported for a while, silent for 10 days → decays to bronze/new", () => {
  const r = scoreReports(daily(10, (i) => 5_000 + i * 20, 10 * 24), now);
  assert.equal(r.recencyScore, 0);
  assert.ok(["bronze", "new"].includes(r.tier), r.tier);
  assert.ok(r.score < 50);
});

test("no reports in the window → 0 / new, no crash", () => {
  assert.deepEqual(scoreReports([], now), { score: 0, tier: "new", recencyScore: 0, frequencyScore: 0, changeRatio: 0, reports: 0, lastReportAt: null });
  // an old report outside the 30-day window doesn't count either
  assert.equal(scoreReports([{ product: "x", price: 1, reportedAt: h(40 * 24) }], now).tier, "new");
});

test("recency decays linearly between 6h and 48h", () => {
  const one = (agoH: number) => scoreReports([{ product: "x", price: 1, reportedAt: h(agoH) }], now).recencyScore;
  assert.equal(one(1), 100);
  assert.equal(one(6), 100);
  assert.equal(one(27), 50);
  assert.equal(one(48), 0);
  assert.equal(one(100), 0);
});

test("change ratio is per product: alternating products with stable prices still counts as no change", () => {
  const reports: Report[] = [];
  for (let d = 0; d < 10; d++) { reports.push({ product: "a", price: 100, reportedAt: h(2 + d * 24) }); reports.push({ product: "b", price: 200, reportedAt: h(3 + d * 24) }); }
  assert.ok(scoreReports(reports, now).changeRatio <= 0.1);
});
