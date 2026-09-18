/**
 * Bazarcha recommendation engine.
 *
 * Pure function: takes candidate listings, returns them ranked.
 * No I/O, no DB — everything it needs is passed in, so it is trivially unit-testable
 * and explainable to a judge.
 *
 *   score = W_PRICE · priceScore + W_QUALITY · qualityScore + W_DISTANCE · distanceScore
 *
 * where each *Score is normalised to 0–100 relative to the other candidates in the set.
 */

export interface Weights {
  price: number;
  quality: number;
  distance: number;
}

/** Default weights — buyer-adjustable later, so keep them named, not inlined. */
export const DEFAULT_WEIGHTS: Weights = Object.freeze({
  price: 0.45,
  quality: 0.35,
  distance: 0.2,
});

/** Verified sellers get this added to their 0–5 rating before normalisation. */
export const VERIFIED_BONUS = 0.5;

export interface Candidate {
  listingId: number;
  sellerId: number;
  sellerName: string;
  bazaar: string;
  region: string;
  province?: string;
  phone?: string;
  minOrderKg?: number;
  verified: boolean;
  rating: number; // 0–5
  reviewCount: number;
  pricePerKg: number; // UZS
  distanceKm: number;
  reportedAt: Date;
}

export interface ScoredCandidate extends Candidate {
  rank: number;
  score: number; // 0–100
  breakdown: {
    priceScore: number;
    qualityScore: number;
    distanceScore: number;
    qualityRaw: number;
  };
}

export interface RankOptions {
  weights?: Partial<Weights>;
  limit?: number;
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Min-max normalise `value` into 0–100 within [min, max].
 * `lowerIsBetter` flips the scale so the cheapest / closest gets 100.
 * If every candidate has the same value there is nothing to differentiate — everyone gets 100.
 */
export function normalizeScore(
  value: number,
  min: number,
  max: number,
  lowerIsBetter: boolean,
): number {
  if (max === min) return 100;
  const t = (value - min) / (max - min); // 0..1
  return (lowerIsBetter ? 1 - t : t) * 100;
}

export function resolveWeights(override?: Partial<Weights>): Weights {
  const w = { ...DEFAULT_WEIGHTS, ...override };
  for (const k of ["price", "quality", "distance"] as const) {
    if (typeof w[k] !== "number" || !Number.isFinite(w[k]) || w[k] < 0) {
      throw new Error(`weights.${k} must be a non-negative number`);
    }
  }
  const sum = w.price + w.quality + w.distance;
  if (sum === 0) throw new Error("weights must not all be zero");
  // Normalise so callers can pass any ratio (e.g. 2:1:1) and still get a 0–100 score.
  return { price: w.price / sum, quality: w.quality / sum, distance: w.distance / sum };
}

export function qualityRaw(c: Pick<Candidate, "rating" | "verified">): number {
  return c.rating + (c.verified ? VERIFIED_BONUS : 0);
}

/**
 * Rank candidates and return the top `limit` (default 3).
 */
export function rankCandidates(
  candidates: Candidate[],
  options: RankOptions = {},
): ScoredCandidate[] {
  const weights = resolveWeights(options.weights);
  const limit = options.limit ?? 3;
  if (candidates.length === 0) return [];

  const prices = candidates.map((c) => c.pricePerKg);
  const qualities = candidates.map(qualityRaw);
  const distances = candidates.map((c) => c.distanceKm);

  const [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  const [qMin, qMax] = [Math.min(...qualities), Math.max(...qualities)];
  const [dMin, dMax] = [Math.min(...distances), Math.max(...distances)];

  const scored = candidates.map((c) => {
    const priceScore = normalizeScore(c.pricePerKg, pMin, pMax, true);
    const qRaw = qualityRaw(c);
    const qualityScore = normalizeScore(qRaw, qMin, qMax, false);
    const distanceScore = normalizeScore(c.distanceKm, dMin, dMax, true);
    const score =
      weights.price * priceScore +
      weights.quality * qualityScore +
      weights.distance * distanceScore;
    return {
      ...c,
      rank: 0,
      score: round(score),
      breakdown: {
        priceScore: round(priceScore),
        qualityScore: round(qualityScore),
        distanceScore: round(distanceScore),
        qualityRaw: round(qRaw, 2),
      },
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.pricePerKg - b.pricePerKg || // tie-break: cheaper first
      a.distanceKm - b.distanceKm,
  );

  return scored.slice(0, limit).map((c, i) => ({ ...c, rank: i + 1 }));
}
