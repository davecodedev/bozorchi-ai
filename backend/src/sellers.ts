import { prisma } from "./db.js";
import { productDef, type Category } from "./products.js";
import { MAX_LISTING_AGE_DAYS } from "./recommend.js";

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
      return { ...seller, products, categories };
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
  return {
    ...seller,
    products: [...latest.values()].map((l) => ({
      product: l.product,
      category: productDef(l.product)?.category ?? null,
      pricePerKg: l.pricePerKg,
      minOrderKg: l.minOrderKg,
      reportedAt: l.reportedAt,
    })),
  };
}
