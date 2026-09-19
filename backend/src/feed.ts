/**
 * "Hot sales" feed: the best-priced current listings, mixed across products so scrolling feels like
 * a For-You page. Each card = one listing, scored by how far below the product's market median it is.
 * Only listings that pass the same trust gate as /recommend (fresh + reliable seller) are shown.
 */
import { prisma } from "./db.js";
import { distanceKm } from "./geo.js";
import { productDef } from "./products.js";
import { MAX_LISTING_AGE_DAYS, MIN_RELIABILITY_SCORE, STALE_AFTER_HOURS } from "./recommend.js";
import { computeReliabilityBulk } from "./reliability.js";

export interface FeedItem {
  listingId: number;
  product: string;
  label: { uz: string; ru: string; en: string } | undefined;
  category: string | null;
  unit: string;
  photoUrl: string | null;
  pricePerKg: number;
  marketMedian: number;
  discountPct: number; // positive = cheaper than the market
  minOrderKg: number;
  reportedAt: Date;
  sellerId: number;
  sellerName: string;
  bazaar: string;
  region: string;
  province: string;
  verified: boolean;
  rating: number;
  reliability: { score: number; tier: string };
  distanceKm: number | null;
}

const cache = new Map<string, { at: number; items: FeedItem[] }>();
const TTL_MS = 60_000;

const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

async function buildFeed(province: string | null, category: string | null, buyer?: { lat: number; lng: number }): Promise<FeedItem[]> {
  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 86_400_000);
  const listings = await prisma.listing.findMany({
    where: { reportedAt: { gte: since }, ...(province ? { seller: { province } } : {}) },
    include: { seller: true },
    orderBy: { reportedAt: "desc" },
  });
  const latest = new Map<string, (typeof listings)[number]>();
  for (const l of listings) { const k = `${l.sellerId}:${l.product}`; if (!latest.has(k)) latest.set(k, l); }
  let current = [...latest.values()];
  if (category) current = current.filter((l) => productDef(l.product)?.category === category);

  const rel = await computeReliabilityBulk([...new Set(current.map((l) => l.sellerId))]);
  const fresh = current.filter((l) => (Date.now() - l.reportedAt.getTime()) / 3_600_000 <= STALE_AFTER_HOURS && (rel.get(l.sellerId)?.score ?? 0) >= MIN_RELIABILITY_SCORE);

  const byProduct = new Map<string, number[]>();
  for (const l of fresh) (byProduct.get(l.product) ?? byProduct.set(l.product, []).get(l.product)!).push(l.pricePerKg);
  const medians = new Map([...byProduct].map(([p, xs]) => [p, median(xs)]));

  const items: FeedItem[] = fresh.map((l) => {
    const def = productDef(l.product);
    const med = medians.get(l.product) ?? l.pricePerKg;
    const r = rel.get(l.sellerId)!;
    return {
      listingId: l.id, product: l.product, label: def?.label, category: def?.category ?? null, unit: def?.unit ?? "kg", photoUrl: l.photoUrl,
      pricePerKg: l.pricePerKg, marketMedian: Math.round(med), discountPct: Math.round(((med - l.pricePerKg) / med) * 100), minOrderKg: l.minOrderKg, reportedAt: l.reportedAt,
      sellerId: l.sellerId, sellerName: l.seller.name, bazaar: l.seller.bazaar, region: l.seller.region, province: l.seller.province, verified: l.seller.verified, rating: l.seller.rating,
      reliability: { score: r.score, tier: r.tier }, distanceKm: buyer ? Math.round(distanceKm(buyer, l.seller) * 10) / 10 : null,
    };
  });

  // Best deal per product first, then round-robin across products so the feed mixes rather than
  // showing 50 tomato sellers in a row.
  const groups = new Map<string, FeedItem[]>();
  for (const it of items.sort((a, b) => b.discountPct - a.discountPct || a.pricePerKg - b.pricePerKg)) (groups.get(it.product) ?? groups.set(it.product, []).get(it.product)!).push(it);
  const queues = [...groups.values()].sort((a, b) => b[0].discountPct - a[0].discountPct);
  const out: FeedItem[] = [];
  for (let round = 0; out.length < items.length; round++) for (const q of queues) if (q[round]) out.push(q[round]);
  return out;
}

export async function hotFeed(opts: { province?: string | null; category?: string | null; offset?: number; limit?: number; lat?: number; lng?: number }) {
  const province = opts.province || null, category = opts.category || null;
  const key = `${province}|${category}|${opts.lat ?? ""}|${opts.lng ?? ""}`;
  const hit = cache.get(key);
  const items = hit && Date.now() - hit.at < TTL_MS ? hit.items : await buildFeed(province, category, typeof opts.lat === "number" && typeof opts.lng === "number" ? { lat: opts.lat, lng: opts.lng } : undefined);
  if (!hit || Date.now() - hit.at >= TTL_MS) cache.set(key, { at: Date.now(), items });
  const offset = Math.max(0, opts.offset ?? 0), limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  return { items: items.slice(offset, offset + limit), total: items.length, offset, nextOffset: offset + limit < items.length ? offset + limit : null };
}
