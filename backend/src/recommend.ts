import { prisma } from "./db.js";
import { distanceKm, resolveProvince, resolveRegion } from "./geo.js";
import { productLabel, productUnit, resolveProduct } from "./products.js";
import { computeReliabilityBulk, type Tier } from "./reliability.js";
import { rankCandidates, type Candidate, type Weights } from "./scoring.js";

/** Listings older than this are ignored — a 3-week-old price is not a price. */
export const MAX_LISTING_AGE_DAYS = 21;
/**
 * Without an explicit province, only sellers within this radius compete. Otherwise a single
 * 1000 km outlier stretches the distance scale and a 260 km seller looks "fairly close".
 */
export const DEFAULT_RADIUS_KM = 80;
/** Trust gate (P5): a listing only competes for the top-N if its seller clears both bars. */
export const MIN_RELIABILITY_SCORE = 20;
export const STALE_AFTER_HOURS = 48;

export interface RecommendRequest {
  product: string;
  /** Tashkent district (from the bot) — sets buyer location only. */
  region?: string;
  /** Province key (from the Mini App chips) — filters sellers AND sets buyer location. */
  province?: string;
  /** Requested order size in the listing's unit (kg / l / dona / qop / m); sellers whose minimum order is larger are excluded. */
  quantityKg?: number;
  /** Search radius in km. Defaults to DEFAULT_RADIUS_KM, or unlimited when a province is given. */
  radiusKm?: number;
  /** Hard cap from the caller's tier (see limits.ts); applied on top of `limit`. */
  maxResults?: number;
  /** Whether custom weights may be honoured (Enterprise). */
  allowWeights?: boolean;
  /** Learned per-buyer weights (P4); used when the caller didn't pass explicit weights. */
  personalWeights?: Weights;
  /** Set to false to skip the reliability/staleness gate (admin views). */
  gate?: boolean;
  lat?: number;
  lng?: number;
  limit?: number;
  weights?: Partial<Weights>;
}

export class RecommendError extends Error {
  constructor(public status: number, message: string, public extra?: unknown) {
    super(message);
  }
}

export async function recommend(req: RecommendRequest) {
  if (!req.product || typeof req.product !== "string") {
    throw new RecommendError(400, "product is required");
  }
  const productKey = resolveProduct(req.product);
  if (!productKey) {
    throw new RecommendError(404, `Unknown product "${req.product}"`, {
      hint: "Try: pomidor / kartoshka / piyoz",
    });
  }

  const province = resolveProvince(req.province);
  const buyer =
    typeof req.lat === "number" && typeof req.lng === "number"
      ? { lat: req.lat, lng: req.lng }
      : resolveRegion(req.region, province?.key);
  const quantityKg =
    typeof req.quantityKg === "number" && req.quantityKg > 0 ? req.quantityKg : undefined;

  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Latest listing per seller for this product (a seller may have re-reported).
  const listings = await prisma.listing.findMany({
    where: {
      product: productKey,
      reportedAt: { gte: since },
      seller: { suspended: false, ...(province ? { province: province.key } : {}) },
      ...(quantityKg ? { minOrderKg: { lte: quantityKg } } : {}),
    },
    include: { seller: true },
    orderBy: { reportedAt: "desc" },
  });
  const latestBySeller = new Map<number, (typeof listings)[number]>();
  for (const l of listings) if (!latestBySeller.has(l.sellerId)) latestBySeller.set(l.sellerId, l);

  const radiusKm =
    typeof req.radiusKm === "number" && req.radiusKm > 0
      ? req.radiusKm
      : province
        ? Infinity
        : DEFAULT_RADIUS_KM;

  const allCandidates: Candidate[] = [...latestBySeller.values()].map((l) => ({
    listingId: l.id,
    sellerId: l.sellerId,
    sellerName: l.seller.name,
    bazaar: l.seller.bazaar,
    region: l.seller.region,
    province: l.seller.province,
    minOrderKg: l.minOrderKg,
    photoUrl: l.photoUrl ?? undefined,
    verified: l.seller.verified,
    rating: l.seller.rating,
    reviewCount: l.seller.reviewCount,
    pricePerKg: l.pricePerKg,
    distanceKm: Math.round(distanceKm(buyer, l.seller) * 10) / 10,
    reportedAt: l.reportedAt,
  })).filter((c) => c.distanceKm <= radiusKm);

  // ---- P5 trust gate: reliability + staleness. Not a weight — a filter on who may enter the top-N.
  const reliability = await computeReliabilityBulk(allCandidates.map((c) => c.sellerId));
  const excluded: { sellerId: number; sellerName: string; reason: "stale" | "low_reliability"; tier: Tier; score: number; reportedHoursAgo: number }[] = [];
  let candidates = allCandidates;
  if (req.gate !== false) {
    candidates = allCandidates.filter((c) => {
      const r = reliability.get(c.sellerId)!;
      const hours = (Date.now() - c.reportedAt.getTime()) / 3_600_000;
      const reason = hours > STALE_AFTER_HOURS ? "stale" : r.score < MIN_RELIABILITY_SCORE ? "low_reliability" : null;
      if (reason) excluded.push({ sellerId: c.sellerId, sellerName: c.sellerName, reason, tier: r.tier, score: r.score, reportedHoursAgo: Math.round(hours) });
      return !reason;
    });
  }
  // never return an empty top-N just because everyone failed the gate — relax it and say so
  const gateRelaxed = candidates.length === 0 && allCandidates.length > 0;
  if (gateRelaxed) candidates = allCandidates;

  const cap = req.maxResults ?? 3;
  const limit = Math.min(req.limit ?? 3, cap);
  const explicit = req.allowWeights === false ? undefined : req.weights;
  const weights = explicit ?? req.personalWeights;
  let ranked;
  try {
    ranked = rankCandidates(candidates, { weights, limit });
  } catch (e) {
    throw new RecommendError(400, (e as Error).message);
  }

  return {
    product: productKey,
    label: productLabel(productKey),
    unit: productUnit(productKey),
    province: province?.key ?? null,
    quantityKg: quantityKg ?? null,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
    weightsApplied: Boolean(explicit),
    personalized: !explicit && Boolean(req.personalWeights),
    weights: weights ?? null,
    maxResults: cap,
    gate: { applied: req.gate !== false && !gateRelaxed, relaxed: gateRelaxed, minReliability: MIN_RELIABILITY_SCORE, staleAfterHours: STALE_AFTER_HOURS },
    excluded,
    buyerLocation: buyer,
    candidates: candidates.length,
    results: ranked.map((r) => ({
      ...r,
      reliability: { score: reliability.get(r.sellerId)?.score ?? 0, tier: reliability.get(r.sellerId)?.tier ?? "new" },
      aiPick: r.rank === 1,
      reportedDaysAgo: Math.floor((Date.now() - r.reportedAt.getTime()) / 86_400_000),
    })),
  };
}
