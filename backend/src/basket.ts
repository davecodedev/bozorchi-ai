/**
 * Basket quote (Enterprise): "500 kg pomidor, 200 kg piyoz, 100 kg sabzi" →
 *   A) cheapest single supplier that carries everything
 *   B) cheapest split across suppliers
 * both with a distance-based delivery estimate, so the buyer sees the real total.
 */
import { prisma } from "./db.js";
import { distanceKm, resolveProvince, resolveRegion } from "./geo.js";
import { productLabel, resolveProduct } from "./products.js";
import { MAX_LISTING_AGE_DAYS, DEFAULT_RADIUS_KM } from "./recommend.js";

/** Rough cost of one delivery trip per km (small truck, Tashkent, 2026). */
export const DELIVERY_UZS_PER_KM = 4_000;
export const DELIVERY_BASE_UZS = 50_000;

export interface BasketItem { product: string; quantityKg: number }

/** Parse free text like "500 kg pomidor, 2 t piyoz\n100kg sabzi" into items. Unknown lines are returned separately. */
export function parseBasket(text: string): { items: BasketItem[]; unknown: string[] } {
  const items: BasketItem[] = [];
  const unknown: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/(\d+(?:[.,]\d+)?)\s*(kg|кг|t|tonna|тонн[аы]?|т|dona|ta|шт|qop|мешок|l|litr|л|m|metr|м)\b/i);
    let qty = 100;
    let rest = line;
    if (m) {
      const n = parseFloat(m[1].replace(",", "."));
      qty = /^(t|tonna|тонн|т)/i.test(m[2]) ? n * 1000 : n;
      rest = line.replace(m[0], " ");
    }
    const product = resolveProduct(rest);
    if (product) items.push({ product, quantityKg: qty });
    else unknown.push(line);
  }
  return { items, unknown };
}

export interface QuoteRequest {
  items: BasketItem[];
  province?: string;
  region?: string;
  lat?: number;
  lng?: number;
}

export async function quoteBasket(req: QuoteRequest) {
  const province = resolveProvince(req.province);
  const buyer = typeof req.lat === "number" && typeof req.lng === "number" ? { lat: req.lat, lng: req.lng } : resolveRegion(req.region, province?.key);
  const radiusKm = province ? Infinity : DEFAULT_RADIUS_KM;
  const since = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 86_400_000);

  const listings = await prisma.listing.findMany({
    where: { product: { in: req.items.map((i) => i.product) }, reportedAt: { gte: since }, ...(province ? { seller: { province: province.key } } : {}) },
    include: { seller: true },
    orderBy: { reportedAt: "desc" },
  });

  // latest listing per (seller, product), within radius, respecting min order
  type Offer = { sellerId: number; sellerName: string; bazaar: string; region: string; verified: boolean; rating: number; distanceKm: number; product: string; pricePerKg: number; minOrderKg: number };
  const offers = new Map<string, Offer>();
  const sellers = new Map<number, Offer>();
  for (const l of listings) {
    const key = `${l.sellerId}:${l.product}`;
    if (offers.has(key)) continue;
    const d = Math.round(distanceKm(buyer, l.seller) * 10) / 10;
    if (d > radiusKm) continue;
    const o: Offer = { sellerId: l.sellerId, sellerName: l.seller.name, bazaar: l.seller.bazaar, region: l.seller.region, verified: l.seller.verified, rating: l.seller.rating, distanceKm: d, product: l.product, pricePerKg: l.pricePerKg, minOrderKg: l.minOrderKg };
    offers.set(key, o);
    sellers.set(l.sellerId, o);
  }
  const delivery = (d: number) => Math.round(DELIVERY_BASE_UZS + d * DELIVERY_UZS_PER_KM);
  const line = (o: Offer, qty: number) => ({ product: o.product, label: productLabel(o.product), quantityKg: qty, sellerId: o.sellerId, sellerName: o.sellerName, bazaar: o.bazaar, region: o.region, verified: o.verified, rating: o.rating, distanceKm: o.distanceKm, pricePerKg: o.pricePerKg, subtotal: o.pricePerKg * qty });

  // ---- A: single supplier
  let single: null | { sellerId: number; sellerName: string; bazaar: string; region: string; verified: boolean; rating: number; distanceKm: number; lines: ReturnType<typeof line>[]; goods: number; delivery: number; total: number } = null;
  for (const s of sellers.values()) {
    const lines = [];
    let ok = true;
    for (const it of req.items) {
      const o = offers.get(`${s.sellerId}:${it.product}`);
      if (!o || o.minOrderKg > it.quantityKg) { ok = false; break; }
      lines.push(line(o, it.quantityKg));
    }
    if (!ok) continue;
    const goods = lines.reduce((a, l) => a + l.subtotal, 0);
    const del = delivery(s.distanceKm);
    const total = goods + del;
    if (!single || total < single.total) single = { sellerId: s.sellerId, sellerName: s.sellerName, bazaar: s.bazaar, region: s.region, verified: s.verified, rating: s.rating, distanceKm: s.distanceKm, lines, goods, delivery: del, total };
  }

  // ---- B: best split — cheapest offer per item, one delivery per distinct seller
  const splitLines: ReturnType<typeof line>[] = [];
  const unavailable: string[] = [];
  for (const it of req.items) {
    let best: Offer | undefined;
    for (const o of offers.values()) if (o.product === it.product && o.minOrderKg <= it.quantityKg && (!best || o.pricePerKg < best.pricePerKg)) best = o;
    if (best) splitLines.push(line(best, it.quantityKg));
    else unavailable.push(it.product);
  }
  const splitSellers = [...new Map(splitLines.map((l) => [l.sellerId, l])).values()];
  const splitGoods = splitLines.reduce((a, l) => a + l.subtotal, 0);
  const splitDelivery = splitSellers.reduce((a, l) => a + delivery(l.distanceKm), 0);
  const split = { lines: splitLines, sellerCount: splitSellers.length, goods: splitGoods, delivery: splitDelivery, total: splitGoods + splitDelivery };

  const recommended = single && single.total <= split.total ? "single" : "split";
  return {
    items: req.items.map((i) => ({ ...i, label: productLabel(i.product) })),
    buyerLocation: buyer,
    single,
    split,
    unavailable,
    recommended,
    savings: single ? Math.abs(single.total - split.total) : null,
    deliveryModel: { baseUzs: DELIVERY_BASE_UZS, perKmUzs: DELIVERY_UZS_PER_KM },
  };
}
