import { prisma } from "./db.js";
import { distanceKm, resolveRegion } from "./geo.js";
import { productLabel, resolveProduct } from "./products.js";
import { rankCandidates, type Candidate, type Weights } from "./scoring.js";

/** Listings older than this are ignored — a 3-week-old price is not a price. */
export const MAX_LISTING_AGE_DAYS = 21;

export interface RecommendRequest {
  product: string;
  region?: string;
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

  const buyer =
    typeof req.lat === "number" && typeof req.lng === "number"
      ? { lat: req.lat, lng: req.lng }
      : resolveRegion(req.region);

  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Latest listing per seller for this product (a seller may have re-reported).
  const listings = await prisma.listing.findMany({
    where: { product: productKey, reportedAt: { gte: since } },
    include: { seller: true },
    orderBy: { reportedAt: "desc" },
  });
  const latestBySeller = new Map<number, (typeof listings)[number]>();
  for (const l of listings) if (!latestBySeller.has(l.sellerId)) latestBySeller.set(l.sellerId, l);

  const candidates: Candidate[] = [...latestBySeller.values()].map((l) => ({
    listingId: l.id,
    sellerId: l.sellerId,
    sellerName: l.seller.name,
    bazaar: l.seller.bazaar,
    region: l.seller.region,
    verified: l.seller.verified,
    rating: l.seller.rating,
    reviewCount: l.seller.reviewCount,
    pricePerKg: l.pricePerKg,
    distanceKm: Math.round(distanceKm(buyer, l.seller) * 10) / 10,
    reportedAt: l.reportedAt,
  }));

  let ranked;
  try {
    ranked = rankCandidates(candidates, { weights: req.weights, limit: req.limit ?? 3 });
  } catch (e) {
    throw new RecommendError(400, (e as Error).message);
  }

  return {
    product: productKey,
    label: productLabel(productKey),
    buyerLocation: buyer,
    candidates: candidates.length,
    results: ranked.map((r) => ({
      ...r,
      aiPick: r.rank === 1,
      reportedDaysAgo: Math.floor((Date.now() - r.reportedAt.getTime()) / 86_400_000),
    })),
  };
}
