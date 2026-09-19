/** Runs against the dev SQLite DB (npm run db:setup first). Uses throw-away buyer ids so it is rerunnable. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db.ts";
import { unlockContact, usageOf } from "./contactUnlock.ts";
import { setTier, TIERS } from "./tiers.ts";

const sellers = await prisma.seller.findMany({ select: { id: true }, orderBy: { id: "asc" } });
const ids = sellers.map((s) => s.id);
const fresh = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("free buyer: 3 distinct unlocks succeed today, the 4th is quota_exceeded naming Pro / 20", async () => {
  const uid = fresh();
  for (let i = 0; i < 3; i++) {
    const r = await unlockContact(uid, ids[i]);
    assert.equal(r.status, "unlocked");
    if (r.status === "unlocked") { assert.ok(r.contact.phone); assert.ok(r.contact.mapsUrl.includes("maps.google.com")); assert.equal(r.usage.used, i + 1); }
  }
  const fourth = await unlockContact(uid, ids[3]);
  assert.equal(fourth.status, "quota_exceeded");
  if (fourth.status === "quota_exceeded") { assert.equal(fourth.tier, "free"); assert.equal(fourth.quota, 3); assert.deepEqual(fourth.next, { tier: "pro", quota: 20, priceUsd: TIERS.pro.priceUsd }); }
});

test("re-requesting an already unlocked seller → already_unlocked and no quota charge", async () => {
  const uid = fresh();
  await unlockContact(uid, ids[0]);
  const again = await unlockContact(uid, ids[0]);
  assert.equal(again.status, "already_unlocked");
  if (again.status === "already_unlocked") assert.equal(again.usage.used, 1);
  // even at quota, a previously unlocked seller is still readable
  for (let i = 1; i < 3; i++) await unlockContact(uid, ids[i]);
  assert.equal((await unlockContact(uid, ids[3])).status, "quota_exceeded");
  assert.equal((await unlockContact(uid, ids[2])).status, "already_unlocked");
});

test("pro buyer: 20 unlocks a day ok, the 21st hits quota and names Max", async () => {
  const uid = fresh();
  const b = await prisma.buyer.create({ data: { telegramUserId: uid } });
  await setTier(b.id, "pro");
  assert.ok(ids.length >= 21, "seed has fewer than 21 sellers — extend the seed");
  for (let i = 0; i < 20; i++) assert.equal((await unlockContact(uid, ids[i])).status, "unlocked");
  const r = await unlockContact(uid, ids[20]);
  assert.equal(r.status, "quota_exceeded");
  if (r.status === "quota_exceeded") assert.equal(r.next?.tier, "max");
});

test("max buyer: verifiedBuyer is set and the seller-facing notice carries the tag", async () => {
  const uid = fresh();
  const b = await prisma.buyer.create({ data: { telegramUserId: uid, name: "Bahor Restaurant" } });
  const upgraded = await setTier(b.id, "max");
  assert.equal(upgraded.verifiedBuyer, true);
  const r = await unlockContact(uid, ids[0]);
  assert.equal(r.status, "unlocked");
  if (r.status === "unlocked") { assert.match(r.sellerNotice, /✅ Tasdiqlangan xaridor/); assert.match(r.sellerNotice, /Bahor Restaurant/); assert.equal(r.usage.unlimited, true); }
  // a free buyer's notice has no tag
  const f = await unlockContact(fresh(), ids[0]);
  if (f.status === "unlocked") assert.doesNotMatch(f.sellerNotice, /Tasdiqlangan/);
});

test("downgrading back to free clears verifiedBuyer", async () => {
  const b = await prisma.buyer.create({ data: { telegramUserId: fresh() } });
  await setTier(b.id, "max");
  const back = await setTier(b.id, "free");
  assert.equal(back.verifiedBuyer, false);
  assert.equal((await usageOf(back)).tier, "free");
});
