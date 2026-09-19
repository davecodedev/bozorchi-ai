/**
 * Seller reliability (P5): a trust / data-quality signal computed from the seller's own price
 * reports inside a rolling window. Deliberately NOT part of the price/quality/distance formula —
 * scoring uses it only as a gate on the trusted top-N.
 *
 *   score = 0.4·recency + 0.3·frequency + 0.3·(changeRatio·100)
 *   recency   : 100 if the last report is < 6h old, linearly down to 0 at 48h+
 *   frequency : distinct calendar days with ≥1 report in the window, as % of the window (cap 100)
 *   changeRatio: share of reports that actually changed the price vs. the seller's own previous
 *                report for that product — resubmitting the same price earns nothing (anti-farming)
 *
 * Because everything is computed inside the window, reliability decays by itself as the window
 * moves; no cron job needed.
 */
import { prisma } from "./db.js";

export const RELIABILITY_WINDOW_DAYS = 30;
export const RECENCY_FULL_HOURS = 6;
export const RECENCY_ZERO_HOURS = 48;
export const TIER_GOLD = 80;
export const TIER_SILVER = 50;
export const TIER_BRONZE = 20;

export type Tier = "gold" | "silver" | "bronze" | "new";

export interface Reliability {
  score: number;
  tier: Tier;
  recencyScore: number;
  frequencyScore: number;
  changeRatio: number;
  reports: number;
  lastReportAt: Date | null;
}

export interface Report { product: string; price: number; reportedAt: Date }

export const tierOf = (score: number): Tier => (score >= TIER_GOLD ? "gold" : score >= TIER_SILVER ? "silver" : score >= TIER_BRONZE ? "bronze" : "new");

/** Pure scoring of one seller's reports inside the window. Exported for tests. */
export function scoreReports(reports: Report[], now = new Date(), windowDays = RELIABILITY_WINDOW_DAYS): Reliability {
  const since = now.getTime() - windowDays * 86_400_000;
  const inWindow = reports.filter((r) => r.reportedAt.getTime() >= since && r.reportedAt.getTime() <= now.getTime()).sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime());
  if (inWindow.length === 0) return { score: 0, tier: "new", recencyScore: 0, frequencyScore: 0, changeRatio: 0, reports: 0, lastReportAt: null };

  const last = inWindow[inWindow.length - 1].reportedAt;
  const hours = (now.getTime() - last.getTime()) / 3_600_000;
  const recencyScore = hours <= RECENCY_FULL_HOURS ? 100 : hours >= RECENCY_ZERO_HOURS ? 0 : Math.round(100 * (1 - (hours - RECENCY_FULL_HOURS) / (RECENCY_ZERO_HOURS - RECENCY_FULL_HOURS)));

  const days = new Set(inWindow.map((r) => Math.floor(r.reportedAt.getTime() / 86_400_000)));
  const frequencyScore = Math.min(100, Math.round((days.size / windowDays) * 100));

  // change ratio: compare each report with the seller's own immediately-prior report for that product
  const lastPrice = new Map<string, number>();
  let changed = 0, compared = 0;
  for (const r of inWindow) {
    const prev = lastPrice.get(r.product);
    if (prev !== undefined) { compared++; if (r.price !== prev) changed++; }
    lastPrice.set(r.product, r.price);
  }
  // a seller's first-ever report in the window has nothing to compare against; count it as a change
  const changeRatio = compared === 0 ? 1 : Math.round(((changed + (inWindow.length - compared)) / inWindow.length) * 100) / 100;

  const score = Math.round(0.4 * recencyScore + 0.3 * frequencyScore + 0.3 * changeRatio * 100);
  return { score, tier: tierOf(score), recencyScore, frequencyScore, changeRatio, reports: inWindow.length, lastReportAt: last };
}

export async function computeReliability(sellerId: number | string, windowDays = RELIABILITY_WINDOW_DAYS): Promise<{ score: number; tier: Tier } & Reliability> {
  const map = await computeReliabilityBulk([Number(sellerId)], windowDays);
  return map.get(Number(sellerId)) ?? scoreReports([]);
}

/** One query for many sellers — used by /recommend's gate and the sellers list. */
export async function computeReliabilityBulk(sellerIds: number[], windowDays = RELIABILITY_WINDOW_DAYS): Promise<Map<number, Reliability>> {
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const rows = sellerIds.length
    ? await prisma.priceHistory.findMany({ where: { sellerId: { in: sellerIds }, reportedAt: { gte: since } }, select: { sellerId: true, product: true, price: true, reportedAt: true } })
    : [];
  const bySeller = new Map<number, Report[]>();
  for (const r of rows) (bySeller.get(r.sellerId) ?? bySeller.set(r.sellerId, []).get(r.sellerId)!).push(r);
  const out = new Map<number, Reliability>();
  for (const id of sellerIds) out.set(id, scoreReports(bySeller.get(id) ?? [], now, windowDays));
  return out;
}
