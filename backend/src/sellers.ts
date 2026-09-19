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
        product: l.product,
        category: productDef(l.product)?.category ?? null,
        pricePerKg: l.pricePerKg,
        minOrderKg: l.minOrderKg,
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
  const reliability = await computeReliability(s.id);
  const products = await Promise.all(
    [...latest.values()].map(async (l) => ({
      product: l.product,
      category: productDef(l.product)?.category ?? null,
      pricePerKg: l.pricePerKg,
      minOrderKg: l.minOrderKg,
      reportedAt: l.reportedAt,
      trend: await forecastTrend(l.product, s.province), // P3: "Narx tendensiyasi: so'nggi 30 kunda +15%"
    })),
  );
  return { ...seller, products, reliability };
}
