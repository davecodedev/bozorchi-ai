import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommission } from "./commission.ts";

test("brackets: whole-order rate by bracket, split 50/50", () => {
  assert.deepEqual(calculateCommission(600_000), { rate: 0.01, totalCommission: 6_000, buyerShare: 3_000, sellerShare: 3_000 });
  assert.deepEqual(calculateCommission(2_500_000), { rate: 0.02, totalCommission: 50_000, buyerShare: 25_000, sellerShare: 25_000 });
  assert.deepEqual(calculateCommission(7_000_000), { rate: 0.03, totalCommission: 210_000, buyerShare: 105_000, sellerShare: 105_000 });
  assert.deepEqual(calculateCommission(12_000_000), { rate: 0.05, totalCommission: 600_000, buyerShare: 300_000, sellerShare: 300_000 });
});

test("boundaries use >= : exactly 1M → 2%, exactly 5M → 3%, exactly 10M → 5%; just below stays in the lower bracket", () => {
  assert.equal(calculateCommission(999_999).rate, 0.01);
  assert.equal(calculateCommission(1_000_000).rate, 0.02);
  assert.equal(calculateCommission(4_999_999).rate, 0.02);
  assert.equal(calculateCommission(5_000_000).rate, 0.03);
  assert.equal(calculateCommission(5_000_000).totalCommission, 150_000);
  assert.equal(calculateCommission(9_999_999).rate, 0.03);
  assert.equal(calculateCommission(10_000_000).rate, 0.05);
});

test("odd totals split without losing a so'm", () => {
  const c = calculateCommission(333_333); // 1% = 3333.33 → 3333
  assert.equal(c.totalCommission, 3_333);
  assert.equal(c.buyerShare + c.sellerShare, c.totalCommission);
});

test("rejects nonsense input", () => {
  assert.throws(() => calculateCommission(-1));
  assert.throws(() => calculateCommission(NaN));
});
