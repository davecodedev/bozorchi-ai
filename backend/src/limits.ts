/** Tiers, quotas and (fake, for now) prices. Everything the paywall needs, in one place. */
import type { Buyer } from "@prisma/client";
import { prisma } from "./db.js";

export type Tier = "standard" | "enterprise";

export const DAILY_FREE_SEARCHES = 5;
export const CREDIT_PACK_SIZE = 20;
export const CREDIT_PACK_PRICE_UZS = 15_000;
export const ENTERPRISE_PRICE_USD = 49;
/** How many ranked results each tier may see. */
export const MAX_RESULTS: Record<Tier, number> = { standard: 3, enterprise: 10 };
/** Feature flags per tier — the Mini App renders locks from this. */
export const FEATURES: Record<Tier, string[]> = {
  standard: ["search", "history"],
  enterprise: ["search", "history", "unlimited", "top10", "weights", "forecast", "basket", "alerts"],
};

const today = () => new Date().toISOString().slice(0, 10);

export function usageOf(b: Buyer) {
  const tier = (b.tier === "enterprise" ? "enterprise" : "standard") as Tier;
  const used = b.searchesDate === today() ? b.searchesUsed : 0;
  return {
    tier,
    used,
    limit: tier === "enterprise" ? null : DAILY_FREE_SEARCHES,
    credits: b.credits,
    remaining: tier === "enterprise" ? null : Math.max(0, DAILY_FREE_SEARCHES - used) + b.credits,
    features: FEATURES[tier],
    prices: { creditPackSize: CREDIT_PACK_SIZE, creditPackUzs: CREDIT_PACK_PRICE_UZS, enterpriseUsd: ENTERPRISE_PRICE_USD },
  };
}

/** Spend one search. Returns the updated usage, or null when the buyer is out of quota. */
export async function consumeSearch(b: Buyer) {
  if (b.tier === "enterprise") return usageOf(b);
  const d = today();
  const used = b.searchesDate === d ? b.searchesUsed : 0;
  let data: Partial<Buyer>;
  if (used < DAILY_FREE_SEARCHES) data = { searchesUsed: used + 1, searchesDate: d };
  else if (b.credits > 0) data = { credits: b.credits - 1, searchesUsed: used, searchesDate: d };
  else return null;
  const updated = await prisma.buyer.update({ where: { id: b.id }, data });
  return usageOf(updated);
}

export const hasFeature = (b: Buyer, f: string) => FEATURES[(b.tier === "enterprise" ? "enterprise" : "standard") as Tier].includes(f);
