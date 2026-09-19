/**
 * Buyer subscription tiers. The ONLY thing a tier gates is how many sellers' contact details
 * (phone + exact location) a buyer may reveal per day (rolling 24 hours). Search, ranking,
 * prices, forecasts and basket quotes are free and unmetered for everyone.
 *
 * Prices are placeholders — confirm before this goes anywhere near investors.
 */
import type { Buyer } from "@prisma/client";
import { prisma } from "./db.js";
import { getSettings } from "./settings.js";

export type Tier = "free" | "pro" | "max";

export const UNLOCK_WINDOW_HOURS = 24;

export const TIERS: Record<Tier, { quota: number; priceUsd: number; unlimited: boolean; verified: boolean }> = {
  free: { quota: 3, priceUsd: 0, unlimited: false, verified: false },
  pro: { quota: 20, priceUsd: 7, unlimited: false, verified: false },
  // 500 is an anti-abuse ceiling, shown to users as "unlimited"
  max: { quota: 500, priceUsd: 79, unlimited: true, verified: true },
};

export const TIER_ORDER: Tier[] = ["free", "pro", "max"];

export const tierOf = (b: Pick<Buyer, "tier">): Tier => (b.tier === "pro" || b.tier === "max" ? b.tier : "free");
export const nextTier = (t: Tier): Tier | null => TIER_ORDER[TIER_ORDER.indexOf(t) + 1] ?? null;

export function tierInfo(t: Tier) {
  return { tier: t, ...TIERS[t] };
}

/** Live tier table: code defaults overridden by admin settings (quota, price). */
export async function liveTiers(): Promise<typeof TIERS> {
  const s = await getSettings();
  return {
    free: { ...TIERS.free, quota: s.tiers.free.quota, priceUsd: s.tiers.free.priceUsd },
    pro: { ...TIERS.pro, quota: s.tiers.pro.quota, priceUsd: s.tiers.pro.priceUsd },
    max: { ...TIERS.max, quota: s.tiers.max.quota, priceUsd: s.tiers.max.priceUsd },
  };
}

/**
 * Change a buyer's tier. Deliberately the only place that writes `tier`/`verifiedBuyer`, so a real
 * checkout (Payme / Click / Telegram Stars) later just calls this after the payment succeeds.
 */
export async function setTier(buyerId: number, tier: Tier) {
  return prisma.buyer.update({
    where: { id: buyerId },
    data: { tier, verifiedBuyer: TIERS[tier].verified, upgradedAt: tier === "free" ? null : new Date() },
  });
}
