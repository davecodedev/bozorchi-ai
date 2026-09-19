/**
 * Seller dashboard: what a seller sold, earned and paid in commission over a rolling window,
 * plus how their agreed prices compared with their list prices (gain/loss vs list).
 */
import { calculateCommission } from "./commission.js";
import { prisma } from "./db.js";
import { productLabel, productUnit } from "./products.js";

export const WINDOWS: Record<string, number> = { "12h": 12, "24h": 24, "7d": 7 * 24, "30d": 30 * 24 };

export async function sellerDashboard(sellerId: number, window = "7d") {
  const hours = WINDOWS[window] ?? WINDOWS["7d"];
  const since = new Date(Date.now() - hours * 3_600_000);
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) return null;
  const deals = await prisma.deal.findMany({
    where: { sellerId, updatedAt: { gte: since } },
    include: { listing: true, buyer: { select: { name: true, verifiedBuyer: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const accepted = deals.filter((d) => d.status === "accepted" && d.agreedPrice != null && d.totalValue != null);

  let revenue = 0, commission = 0, listValue = 0, quantity = 0;
  const byProduct = new Map<string, { product: string; quantity: number; revenue: number; deals: number }>();
  const buckets = new Map<string, number>(); // day (or hour for short windows) → revenue
  const bucketHours = hours <= 24 ? 1 : 24;
  for (const d of accepted) {
    const c = calculateCommission(d.totalValue!);
    revenue += d.totalValue!; commission += c.sellerShare; quantity += d.quantity;
    listValue += d.listing.pricePerKg * d.quantity;
    const p = byProduct.get(d.listing.product) ?? { product: d.listing.product, quantity: 0, revenue: 0, deals: 0 };
    p.quantity += d.quantity; p.revenue += d.totalValue!; p.deals += 1; byProduct.set(d.listing.product, p);
    const b = new Date(Math.floor(d.updatedAt.getTime() / (bucketHours * 3_600_000)) * bucketHours * 3_600_000).toISOString();
    buckets.set(b, (buckets.get(b) ?? 0) + d.totalValue!);
  }
  const net = revenue - commission;
  const vsList = revenue - listValue; // positive = sold above list, negative = discounts given
  return {
    seller: { id: seller.id, name: seller.name, bazaar: seller.bazaar, region: seller.region, province: seller.province, rating: seller.rating, verified: seller.verified },
    window, since,
    deals: { total: deals.length, accepted: accepted.length, declined: deals.filter((d) => d.status === "declined").length, open: deals.filter((d) => d.status === "offered" || d.status === "countered").length },
    quantity, revenue, commission, net, listValue, vsList,
    avgDeal: accepted.length ? Math.round(revenue / accepted.length) : 0,
    products: [...byProduct.values()].map((p) => ({ ...p, label: productLabel(p.product), unit: productUnit(p.product) })).sort((a, b) => b.revenue - a.revenue),
    series: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, value]) => ({ at, value })),
    bucketHours,
    recent: deals.slice(0, 8).map((d) => ({ id: d.id, status: d.status, product: d.listing.product, label: productLabel(d.listing.product), unit: productUnit(d.listing.product), quantity: d.quantity, agreedPrice: d.agreedPrice, totalValue: d.totalValue, buyer: d.buyer.name, verifiedBuyer: d.buyer.verifiedBuyer, at: d.updatedAt })),
  };
}
