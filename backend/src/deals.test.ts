/** DB-backed (dev SQLite). Throw-away buyers per test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db.ts";
import { acceptDeal, counterDeal, createDeal, declineDeal, DealError, presentDeal } from "./deals.ts";
import { isUnlocked, usageOf, unlockContact } from "./contactUnlock.ts";

const fresh = () => `deal-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const listing = await prisma.listing.findFirst({ where: { product: "tomato", minOrderKg: { lte: 50 } }, include: { seller: true } });
if (!listing) throw new Error("seed a tomato listing first");

test("seller accepts the initial offer outright → accepted, 1% bracket, contact revealed, quota untouched", async () => {
  const uid = fresh();
  const d = await createDeal(uid, { listingId: listing.id, quantity: 50, pricePerKg: 12_000 }); // 600 000 so'm
  assert.equal(d.status, "offered");
  const a = await acceptDeal(d.id, "seller");
  assert.equal(a.status, "accepted");
  assert.equal(a.agreedPrice, 12_000);
  assert.equal(a.totalValue, 600_000);
  assert.equal(a.commissionAmt, 6_000);
  const p = presentDeal(a);
  assert.deepEqual(p.commission, { rate: 0.01, totalCommission: 6_000, buyerShare: 3_000, sellerShare: 3_000 });
  assert.ok(p.contact && p.contact.phone, "contact revealed on acceptance");
  // the deal, not the reveal, is the monetised event: no unlock quota consumed …
  const buyer = await prisma.buyer.findUniqueOrThrow({ where: { telegramUserId: uid } });
  assert.equal((await usageOf(buyer)).used, 0);
  // … and the seller now reads as unlocked everywhere, still without charging
  assert.equal(await isUnlocked(uid, listing.sellerId), true);
  const r = await unlockContact(uid, listing.sellerId);
  assert.equal(r.status, "already_unlocked");
  assert.equal((await usageOf(buyer)).used, 0);
});

test("seller counters, buyer accepts → countered price drives totalValue and commission (not the original)", async () => {
  const d = await createDeal(fresh(), { listingId: listing.id, quantity: 200, pricePerKg: 12_000 });
  const c = await counterDeal(d.id, 13_500);
  assert.equal(c.status, "countered");
  assert.equal(presentDeal(c).turn, "buyer");
  const a = await acceptDeal(c.id, "buyer");
  assert.equal(a.status, "accepted");
  assert.equal(a.agreedPrice, 13_500);
  assert.equal(a.totalValue, 2_700_000);
  assert.equal(a.commissionAmt, 81_000); // 3% bracket (1M–10M)
});

test("buyer declines the counter → declined, no commission, no contact", async () => {
  const d = await createDeal(fresh(), { listingId: listing.id, quantity: 100, pricePerKg: 12_000 });
  await counterDeal(d.id, 14_000);
  const x = await declineDeal(d.id, "buyer");
  assert.equal(x.status, "declined");
  assert.equal(x.commissionAmt, null);
  const p = presentDeal(x);
  assert.equal(p.commission, null);
  assert.equal(p.contact, null);
  await assert.rejects(() => acceptDeal(d.id, "buyer"), (e: DealError) => e.status === 409);
});

test("a second counter is rejected by the API (409), and the wrong side can't act", async () => {
  const d = await createDeal(fresh(), { listingId: listing.id, quantity: 100, pricePerKg: 12_000 });
  await assert.rejects(() => acceptDeal(d.id, "buyer"), (e: DealError) => e.status === 409); // seller hasn't answered
  await counterDeal(d.id, 13_000);
  await assert.rejects(() => counterDeal(d.id, 13_200), (e: DealError) => e.status === 409 && /one counter/.test(e.message));
  await assert.rejects(() => acceptDeal(d.id, "seller"), (e: DealError) => e.status === 409); // seller can't accept own counter
  await assert.rejects(() => declineDeal(d.id, "seller"), (e: DealError) => e.status === 409);
  assert.equal((await acceptDeal(d.id, "buyer")).status, "accepted");
});

test("order value in the middle bracket (5 000 000 → 3%)", async () => {
  const d = await createDeal(fresh(), { listingId: listing.id, quantity: 500, pricePerKg: 10_000 }); // exactly 5 000 000
  const a = await acceptDeal(d.id, "seller");
  assert.equal(a.totalValue, 5_000_000);
  assert.equal(a.commissionAmt, 150_000);
  assert.equal(presentDeal(a).commission?.rate, 0.03);
});

test("validation: below minimum order or non-positive price is refused", async () => {
  await assert.rejects(() => createDeal(fresh(), { listingId: listing.id, quantity: listing.minOrderKg - 1, pricePerKg: 12_000 }), (e: DealError) => e.status === 400);
  await assert.rejects(() => createDeal(fresh(), { listingId: listing.id, quantity: 100, pricePerKg: 0 }), (e: DealError) => e.status === 400);
});
