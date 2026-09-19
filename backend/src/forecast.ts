/**
 * Price trend forecasting (P3): ordinary least-squares line through the last `windowDays` of
 * price reports for a product in a region. direction/changePercent come from the fitted slope
 * across the window — "linear trend over 30 days of reports". Honest scope: the history is
 * seeded (synthetic) until sellers report for real.
 */
import { prisma } from "./db.js";

export const FORECAST_WINDOW_DAYS = 30;
/** A seller's last price counts toward the daily market mean for at most this many days after their last report. */
export const CARRY_FORWARD_DAYS = 3;
/** Don't start the market series until at least this many sellers are live on a day. */
export const MIN_SELLERS_PER_DAY = 3;

const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const STABLE_BAND_PERCENT = 2;

export interface Trend {
  direction: "up" | "down" | "stable";
  changePercent: number;
  /** extra detail for dashboards; the two fields above are the contract */
  points: number;
  startPrice: number;
  endPrice: number;
  slopePerDay: number;
}

export const NO_TREND: Trend = Object.freeze({ direction: "stable", changePercent: 0, points: 0, startPrice: 0, endPrice: 0, slopePerDay: 0 });

/** Pure least-squares fit over (dayIndex, price) points. Exported for tests. */
export function fitTrend(samples: { day: number; price: number }[], windowDays = FORECAST_WINDOW_DAYS): Trend {
  if (samples.length < 2) return { ...NO_TREND, points: samples.length };
  const n = samples.length;
  const mx = samples.reduce((a, s) => a + s.day, 0) / n;
  const my = samples.reduce((a, s) => a + s.price, 0) / n;
  const sxx = samples.reduce((a, s) => a + (s.day - mx) ** 2, 0);
  if (sxx === 0) return { ...NO_TREND, points: n, startPrice: my, endPrice: my };
  const slope = samples.reduce((a, s) => a + (s.day - mx) * (s.price - my), 0) / sxx;
  const intercept = my - slope * mx;
  const startPrice = intercept; // fitted value at day 0 (start of window)
  const endPrice = intercept + slope * windowDays; // fitted value today
  const changePercent = startPrice > 0 ? Math.round(((endPrice - startPrice) / startPrice) * 1000) / 10 : 0;
  const direction = changePercent > STABLE_BAND_PERCENT ? "up" : changePercent < -STABLE_BAND_PERCENT ? "down" : "stable";
  return { direction, changePercent, points: n, startPrice: Math.round(startPrice), endPrice: Math.round(endPrice), slopePerDay: Math.round(slope * 100) / 100 };
}

/**
 * Market price per day for a product in a region: the MEDIAN over sellers of each seller's latest
 * known price that day (carried forward for up to CARRY_FORWARD_DAYS). One seller = one vote per
 * day, and a single typo'd price can't drag the market line. Index 0 = `windowDays` days ago … last
 * = today. Leading days with fewer than MIN_SELLERS_PER_DAY live sellers are omitted.
 */
export async function marketDailyPrices(product: string, region: string, windowDays = FORECAST_WINDOW_DAYS): Promise<{ day: number; price: number; sellers: number }[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const rows = await prisma.priceHistory.findMany({
    where: { product, region, reportedAt: { gte: since } },
    select: { sellerId: true, price: true, reportedAt: true },
    orderBy: { reportedAt: "asc" },
  });
  const perSellerDay = new Map<number, Map<number, number>>();
  for (const r of rows) {
    const day = Math.floor((r.reportedAt.getTime() - since.getTime()) / 86_400_000);
    (perSellerDay.get(r.sellerId) ?? perSellerDay.set(r.sellerId, new Map()).get(r.sellerId)!).set(day, r.price);
  }
  const samples: { day: number; price: number; sellers: number }[] = [];
  const lastKnown = new Map<number, { price: number; day: number }>();
  for (let day = 0; day <= windowDays; day++) {
    for (const [sellerId, m] of perSellerDay) if (m.has(day)) lastKnown.set(sellerId, { price: m.get(day)!, day });
    // sellers who went quiet drop out of the mean after CARRY_FORWARD_DAYS — a stale price is not a price
    const live = [...lastKnown.values()].filter((v) => day - v.day <= CARRY_FORWARD_DAYS);
    if (live.length === 0 || (samples.length === 0 && live.length < MIN_SELLERS_PER_DAY)) continue;
    samples.push({ day, price: Math.round(median(live.map((v) => v.price))), sellers: live.length });
  }
  return samples;
}

/** Trend for one product in one region (province key) over the rolling window. */
export async function forecastTrend(product: string, region: string, windowDays = FORECAST_WINDOW_DAYS): Promise<Trend> {
  return fitTrend(await marketDailyPrices(product, region, windowDays), windowDays);
}
