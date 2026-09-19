import { prisma } from "./db.js";
import { productDef, type Category } from "./products.js";
import { MAX_LISTING_AGE_DAYS } from "./recommend.js";
import { computeReliability, computeReliabilityBulk } from "./reliability.js";
import { forecastTrend } from "./forecast.js";

export interface SellerFilter {
  province?: string;
  category?: Category | "all";
  q?: string;
}

/** Sellers with a summary of what they currently sell. */
export async function listSellers(f: SellerFilter) {
  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 86_400_000);
  const sellers = await prisma.seller.findMany({
    where: {
      suspended: false,
      ...(f.province ? { province: f.province } : {}),
      ...(f.q ? { name: { contains: f.q } } : {}),
    },
    include: { listings: { where: { reportedAt: { gte: since } }, orderBy: { reportedAt: "desc" } } },
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
  });

  const rel = await computeReliabilityBulk(sellers.map((s) => s.id));
  return sellers
    .map((s) => {
      const latest = new Map<string, (typeof s.listings)[number]>();
      for (const l of s.listings) if (!latest.has(l.product)) latest.set(l.product, l);
      const products = [...latest.values()].map((l) => ({
        listingId: l.id,
        product: l.product,
        category: productDef(l.product)?.category ?? null,
        unit: productDef(l.product)?.unit ?? "kg",
        pricePerKg: l.pricePerKg,
        minOrderKg: l.minOrderKg,
        photoUrl: l.photoUrl,
        reportedAt: l.reportedAt,
      }));
      const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as Category[];
      const { listings: _l, ...seller } = s;
      const r = rel.get(s.id)!;
      return { ...seller, products, categories, reliability: { score: r.score, tier: r.tier, lastReportAt: r.lastReportAt } };
    })
    .filter((s) => !f.category || f.category === "all" || s.categories.includes(f.category));
}

export async function getSeller(id: number) {
  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 86_400_000);
  const s = await prisma.seller.findUnique({
    where: { id },
    include: {
      listings: { where: { reportedAt: { gte: since } }, orderBy: { reportedAt: "desc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { buyer: { select: { name: true } } } },
    },
  });
  if (!s) return null;
  const latest = new Map<string, (typeof s.listings)[number]>();
  for (const l of s.listings) if (!latest.has(l.product)) latest.set(l.product, l);
  const { listings: _l, ...seller } = s;
  const [reliability, dealsDone, reviewsAgg, priceReports] = await Promise.all([
    computeReliability(s.id),
    prisma.deal.count({ where: { sellerId: s.id, status: "accepted" } }),
    prisma.review.aggregate({ where: { sellerId: s.id }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.priceHistory.count({ where: { sellerId: s.id } }),
  ]);
  const first = await prisma.priceHistory.findFirst({ where: { sellerId: s.id }, orderBy: { reportedAt: "asc" }, select: { reportedAt: true } });
  const stats = { posts: latest.size, dealsDone, reviews: reviewsAgg._count._all, avgRating: Math.round((reviewsAgg._avg.rating ?? s.rating) * 10) / 10, priceReports, memberSince: first?.reportedAt ?? new Date() };
  const level = sellerLevel(dealsDone, stats.avgRating, reliability.tier);
  const products = await Promise.all(
    [...latest.values()].map(async (l) => ({
      listingId: l.id,
      product: l.product,
      category: productDef(l.product)?.category ?? null,
      unit: productDef(l.product)?.unit ?? "kg",
      pricePerKg: l.pricePerKg,
      minOrderKg: l.minOrderKg,
      photoUrl: l.photoUrl,
      reportedAt: l.reportedAt,
      trend: await forecastTrend(l.product, s.province), // P3: "Narx tendensiyasi: so'nggi 30 kunda +15%"
    })),
  );
  return { ...seller, products, reliability, stats, level };
}

/** Gamified seller level: deals done × rating × reliability → badge shown on the profile. */
export function sellerLevel(dealsDone: number, avgRating: number, reliabilityTier: string) {
  const badges: string[] = [];
  if (dealsDone >= 50) badges.push("top_seller"); else if (dealsDone >= 10) badges.push("experienced");
  if (avgRating >= 4.7) badges.push("five_star");
  if (reliabilityTier === "gold") badges.push("consistent");
  const pts = dealsDone * 10 + Math.max(0, avgRating - 3) * 50 + (({ gold: 100, silver: 60, bronze: 30 } as Record<string, number>)[reliabilityTier] ?? 0);
  const key = pts >= 700 ? "platinum" : pts >= 400 ? "gold" : pts >= 200 ? "silver" : pts >= 60 ? "bronze" : "starter";
  const next = { starter: 60, bronze: 200, silver: 400, gold: 700, platinum: null }[key] as number | null;
  return { key, points: Math.round(pts), next, badges };
}
