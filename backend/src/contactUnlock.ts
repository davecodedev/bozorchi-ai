/**
 * Contact unlocks: reveal a seller's phone + exact location against the buyer's monthly quota.
 *
 *  1. already unlocked this seller → return the contact again, quota untouched (never charge twice)
 *  2. count unlocks in the rolling 24-hour window (computed at query time, no reset job)
 *  3. under quota → record the unlock, return the contact
 *  4. at/over quota → quota_exceeded with the tier and its quota, so the UI can offer the next tier
 */
import type { Buyer, Seller } from "@prisma/client";
import { prisma } from "./db.js";
import { liveTiers, nextTier, tierOf, UNLOCK_WINDOW_HOURS, type Tier } from "./tiers.js";

export interface Contact {
  sellerId: number;
  sellerName: string;
  phone: string | null;
  bazaar: string;
  region: string;
  lat: number;
  lng: number;
  mapsUrl: string;
}

export type UnlockResult =
  | { status: "unlocked"; contact: Contact; usage: Usage; sellerNotice: string; sellerTelegramUserId: string | null; verifiedBuyer: boolean }
  | { status: "already_unlocked"; contact: Contact; usage: Usage; sellerNotice: string; sellerTelegramUserId: string | null; verifiedBuyer: boolean }
  | { status: "quota_exceeded"; tier: Tier; quota: number; usage: Usage; next: { tier: Tier; quota: number; priceUsd: number } | null };

export interface Usage {
  tier: Tier;
  quota: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  verifiedBuyer: boolean;
  windowHours: number;
  prices: Record<Tier, number>;
}

const windowStart = () => new Date(Date.now() - UNLOCK_WINDOW_HOURS * 3_600_000);

export async function countUnlocks(buyerId: number): Promise<number> {
  return prisma.contactUnlock.count({ where: { buyerId, unlockedAt: { gte: windowStart() } } });
}

export async function usageOf(b: Buyer): Promise<Usage> {
  const tier = tierOf(b);
  const TIERS = await liveTiers();
  const used = await countUnlocks(b.id);
  const { quota, unlimited } = TIERS[tier];
  return {
    tier, quota, used, remaining: Math.max(0, quota - used), unlimited, verifiedBuyer: b.verifiedBuyer,
    windowHours: UNLOCK_WINDOW_HOURS,
    prices: { free: TIERS.free.priceUsd, pro: TIERS.pro.priceUsd, max: TIERS.max.priceUsd },
  };
}

export function contactOf(s: Seller): Contact {
  return { sellerId: s.id, sellerName: s.name, phone: s.phone, bazaar: s.bazaar, region: s.region, lat: s.lat, lng: s.lng, mapsUrl: `https://maps.google.com/?q=${s.lat},${s.lng}` };
}

/** The message a seller receives when a buyer reaches out. Max-tier buyers carry the verified tag. */
export function sellerNoticeFor(buyer: Buyer): string {
  const who = buyer.name || (buyer.username ? "@" + buyer.username : "Xaridor");
  const tag = buyer.verifiedBuyer ? " ✅ Tasdiqlangan xaridor" : "";
  return `📨 ${who}${tag} sizning kontaktingizni oldi va bog'lanmoqchi.`;
}

export async function unlockContact(buyerTelegramUserId: string, sellerId: number | string): Promise<UnlockResult> {
  const buyer = await prisma.buyer.upsert({ where: { telegramUserId: buyerTelegramUserId }, create: { telegramUserId: buyerTelegramUserId }, update: {} });
  const seller = await prisma.seller.findUnique({ where: { id: Number(sellerId) } });
  if (!seller) throw new Error("seller not found");

  const common = () => ({ contact: contactOf(seller), sellerNotice: sellerNoticeFor(buyer), sellerTelegramUserId: seller.telegramUserId, verifiedBuyer: buyer.verifiedBuyer });

  // 1. never charge twice for the same seller — and an old unlock outside the window still counts as unlocked.
  //    An accepted deal with this seller also counts: the deal is the monetised event, not the reveal.
  const existing = await prisma.contactUnlock.findUnique({ where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: seller.id } } });
  const viaDeal = existing ? null : await prisma.deal.findFirst({ where: { buyerId: buyer.id, sellerId: seller.id, status: "accepted" }, select: { id: true } });
  if (existing || viaDeal) return { status: "already_unlocked", ...common(), usage: await usageOf(buyer) };

  // 2–4. rolling-window quota
  const tier = tierOf(buyer);
  const TIERS = await liveTiers();
  const used = await countUnlocks(buyer.id);
  if (used >= TIERS[tier].quota) {
    const n = nextTier(tier);
    return { status: "quota_exceeded", tier, quota: TIERS[tier].quota, usage: await usageOf(buyer), next: n ? { tier: n, quota: TIERS[n].quota, priceUsd: TIERS[n].priceUsd } : null };
  }
  await prisma.contactUnlock.create({ data: { buyerId: buyer.id, sellerId: seller.id } });
  return { status: "unlocked", ...common(), usage: await usageOf(buyer) };
}

/** Has this buyer already unlocked this seller? (for showing the contact without a second click) */
export async function isUnlocked(buyerTelegramUserId: string, sellerId: number): Promise<boolean> {
  const buyer = await prisma.buyer.findUnique({ where: { telegramUserId: buyerTelegramUserId }, select: { id: true } });
  if (!buyer) return false;
  if (await prisma.contactUnlock.findUnique({ where: { buyerId_sellerId: { buyerId: buyer.id, sellerId } } })) return true;
  return Boolean(await prisma.deal.findFirst({ where: { buyerId: buyer.id, sellerId, status: "accepted" }, select: { id: true } }));
}
