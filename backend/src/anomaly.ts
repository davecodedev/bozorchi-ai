/**
 * Price anomaly detection (P2): z-score outliers within each product × region group.
 *
 * Method: for every group compute the mean μ and sample standard deviation σ (n−1) of price and
 * flag listings with |price − μ| / σ > Z_THRESHOLD (2, the conventional "two sigma" cut-off).
 * Groups with fewer than MIN_GROUP_SIZE listings are skipped — σ from 2–3 points is noise, and
 * false alarms on a bazaar admin's dashboard would cost more trust than the misses.
 */
export const Z_THRESHOLD = 2;
export const MIN_GROUP_SIZE = 4;

export interface PricedListing {
  product: string;
  region: string; // province key
  pricePerKg: number;
}

export interface Anomaly<T extends PricedListing = PricedListing> {
  listing: T;
  zScore: number;
  mean: number;
  stdDev: number;
  groupSize: number;
}

export function detectAnomalies<T extends PricedListing>(listings: T[]): T[] {
  return explainAnomalies(listings).map((a) => a.listing);
}

/** Same as detectAnomalies but keeps the numbers — the admin dashboard shows them. */
export function explainAnomalies<T extends PricedListing>(listings: T[]): Anomaly<T>[] {
  const groups = new Map<string, T[]>();
  for (const l of listings) {
    const k = `${l.product}|${l.region}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  const out: Anomaly<T>[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_GROUP_SIZE) continue;
    const prices = group.map((l) => l.pricePerKg);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((a, p) => a + (p - mean) ** 2, 0) / (prices.length - 1));
    if (stdDev === 0) continue; // identical prices — nothing can be an outlier
    for (const l of group) {
      const z = (l.pricePerKg - mean) / stdDev;
      if (Math.abs(z) > Z_THRESHOLD) out.push({ listing: l, zScore: Math.round(z * 100) / 100, mean: Math.round(mean), stdDev: Math.round(stdDev), groupSize: group.length });
    }
  }
  return out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}
