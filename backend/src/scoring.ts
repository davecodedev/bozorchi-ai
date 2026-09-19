/**
 * Bozorchi AI recommendation engine.
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
  minOrderKg?: number;
  photoUrl?: string;
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

// ---------------------------------------------------------------- P4: personalised weights
/**
 * One past "contacted" listing, described by where it ranked among what the buyer could have
 * chosen at the time: 0 = best (cheapest / highest quality / closest), 1 = worst.
 */
export interface Observation {
  priceRank: number;
  qualityRank: number;
  distanceRank?: number;
}

/** Minimum contacts before we trust a pattern. */
export const MIN_OBSERVATIONS = 3;
/** How far a clear preference moves the weights. */
export const PERSONAL_NUDGE = 0.15;
/** How much better one factor's average rank must be than the runner-up to count as a preference. */
export const PREFERENCE_MARGIN = 0.15;

/**
 * Infer which factor a buyer actually optimises for, from the ranks of what they contacted.
 * Pure; the DB-backed getPersonalWeights() below feeds it. Returns DEFAULT_WEIGHTS when the
 * history is thin or ambiguous.
 */
export function inferPersonalWeights(obs: Observation[]): { weights: Weights; preference: keyof Weights | null } {
  if (obs.length < MIN_OBSERVATIONS) return { weights: { ...DEFAULT_WEIGHTS }, preference: null };
  const avg = (k: keyof Observation) => {
    const vals = obs.map((o) => o[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
  };
  const ranks: Record<keyof Weights, number> = { price: avg("priceRank"), quality: avg("qualityRank"), distance: avg("distanceRank") };
  const sorted = (Object.keys(ranks) as (keyof Weights)[]).sort((a, b) => ranks[a] - ranks[b]);
  const [best, second] = sorted;
  if (ranks[second] - ranks[best] < PREFERENCE_MARGIN) return { weights: { ...DEFAULT_WEIGHTS }, preference: null };
  const w = { ...DEFAULT_WEIGHTS };
  const others = (Object.keys(w) as (keyof Weights)[]).filter((k) => k !== best);
  const pool = others.reduce((a, k) => a + w[k], 0);
  w[best] = round(w[best] + PERSONAL_NUDGE, 2);
  for (const k of others) w[k] = round(w[k] - PERSONAL_NUDGE * (w[k] / pool), 2);
  return { weights: w, preference: best };
}

/**
 * Look up a buyer's contacted listings and infer their weights. For each contact, the listing's
 * rank is measured against what was on offer for that product in that province (latest listing
 * per seller) — "did they pick the cheapest? the best-rated?". Default weights for no history.
 */
export async function getPersonalWeights(buyerTelegramUserId: string): Promise<{ weights: Weights; preference: keyof Weights | null; contacts: number }> {
  const { prisma } = await import("./db.js"); // lazy so the pure part of this module stays DB-free
  const buyer = await prisma.buyer.findUnique({ where: { telegramUserId: buyerTelegramUserId }, select: { id: true } });
  if (!buyer) return { weights: { ...DEFAULT_WEIGHTS }, preference: null, contacts: 0 };
  const contacts = await prisma.buyerInteraction.findMany({
    where: { buyerId: buyer.id, action: "contacted" },
    include: { listing: { include: { seller: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  if (contacts.length < MIN_OBSERVATIONS) return { weights: { ...DEFAULT_WEIGHTS }, preference: null, contacts: contacts.length };

  const obs: Observation[] = [];
  for (const c of contacts) {
    const peers = await prisma.listing.findMany({
      where: { product: c.listing.product, seller: { province: c.listing.seller.province } },
      include: { seller: true },
      orderBy: { reportedAt: "desc" },
    });
    const latest = new Map<number, (typeof peers)[number]>();
    for (const p of peers) if (!latest.has(p.sellerId)) latest.set(p.sellerId, p);
    const pool = [...latest.values()];
    if (pool.length < 2) continue;
    const rank = (sorted: number[], v: number) => sorted.indexOf(v) / (sorted.length - 1);
    const prices = [...new Set(pool.map((p) => p.pricePerKg))].sort((a, b) => a - b);
    const quals = [...new Set(pool.map((p) => qualityRaw(p.seller)))].sort((a, b) => b - a);
    obs.push({ priceRank: rank(prices, c.listing.pricePerKg), qualityRank: rank(quals, qualityRaw(c.listing.seller)) });
  }
  return { ...inferPersonalWeights(obs), contacts: contacts.length };
}
