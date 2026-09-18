import { prisma } from "./db.js";
import { distanceKm, resolveProvince, resolveRegion } from "./geo.js";
import { productLabel, resolveProduct } from "./products.js";
import { rankCandidates, type Candidate, type Weights } from "./scoring.js";

/** Listings older than this are ignored — a 3-week-old price is not a price. */
export const MAX_LISTING_AGE_DAYS = 21;
/**
 * Without an explicit province, only sellers within this radius compete. Otherwise a single
 * 1000 km outlier stretches the distance scale and a 260 km seller looks "fairly close".
 */
export const DEFAULT_RADIUS_KM = 80;

export interface RecommendRequest {
  product: string;
  /** Tashkent district (from the bot) — sets buyer location only. */
  region?: string;
  /** Province key (from the Mini App chips) — filters sellers AND sets buyer location. */
  province?: string;
  /** Requested order size; sellers whose minimum order is larger are excluded. */
  quantityKg?: number;
  /** Search radius in km. Defaults to DEFAULT_RADIUS_KM, or unlimited when a province is given. */
  radiusKm?: number;
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
      ...(province ? { seller: { province: province.key } } : {}),
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

  const candidates: Candidate[] = [...latestBySeller.values()].map((l) => ({
    listingId: l.id,
    sellerId: l.sellerId,
    sellerName: l.seller.name,
    bazaar: l.seller.bazaar,
    region: l.seller.region,
    province: l.seller.province,
    phone: l.seller.phone ?? undefined,
    minOrderKg: l.minOrderKg,
    verified: l.seller.verified,
    rating: l.seller.rating,
    reviewCount: l.seller.reviewCount,
    pricePerKg: l.pricePerKg,
    distanceKm: Math.round(distanceKm(buyer, l.seller) * 10) / 10,
    reportedAt: l.reportedAt,
  })).filter((c) => c.distanceKm <= radiusKm);

  let ranked;
  try {
    ranked = rankCandidates(candidates, { weights: req.weights, limit: req.limit ?? 3 });
  } catch (e) {
    throw new RecommendError(400, (e as Error).message);
  }

  return {
    product: productKey,
    label: productLabel(productKey),
    province: province?.key ?? null,
    quantityKg: quantityKg ?? null,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
    buyerLocation: buyer,
    candidates: candidates.length,
    results: ranked.map((r) => ({
      ...r,
      aiPick: r.rank === 1,
      reportedDaysAgo: Math.floor((Date.now() - r.reportedAt.getTime()) / 86_400_000),
    })),
  };
}
