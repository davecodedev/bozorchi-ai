import { test } from "node:test";
import assert from "node:assert/strict";
import { fitTrend } from "./forecast.ts";

test("a clean 15% rise over 30 days fits as 'up' ≈ +15%", () => {
  const samples = Array.from({ length: 31 }, (_, day) => ({ day, price: 10_000 * (1 + 0.15 * (day / 30)) }));
  const t = fitTrend(samples, 30);
  assert.equal(t.direction, "up");
  assert.ok(Math.abs(t.changePercent - 15) < 0.5, `got ${t.changePercent}`);
});

test("a fall fits as 'down' with a negative percent", () => {
  const samples = Array.from({ length: 31 }, (_, day) => ({ day, price: 5_000 * (1 - 0.08 * (day / 30)) }));
  const t = fitTrend(samples, 30);
  assert.equal(t.direction, "down");
  assert.ok(Math.abs(t.changePercent + 8) < 0.5, `got ${t.changePercent}`);
});

test("noise around a flat price is 'stable' (within ±2%)", () => {
  const samples = Array.from({ length: 31 }, (_, day) => ({ day, price: 7_000 + (day % 3) * 30 - 30 }));
  assert.equal(fitTrend(samples, 30).direction, "stable");
});

test("sparse reports (every 2nd day) still recover the trend", () => {
  const samples = Array.from({ length: 16 }, (_, i) => ({ day: i * 2, price: 4_000 * (1 + 0.1 * ((i * 2) / 30)) }));
  const t = fitTrend(samples, 30);
  assert.equal(t.direction, "up");
  assert.ok(Math.abs(t.changePercent - 10) < 0.5, `got ${t.changePercent}`);
});

test("too few points → stable / 0, never NaN", () => {
  assert.deepEqual(fitTrend([], 30).changePercent, 0);
  assert.equal(fitTrend([{ day: 3, price: 100 }], 30).direction, "stable");
  const same = fitTrend([{ day: 5, price: 100 }, { day: 5, price: 120 }], 30);
  assert.equal(same.direction, "stable");
  assert.ok(Number.isFinite(same.changePercent));
});
