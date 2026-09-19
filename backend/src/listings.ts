/**
 * Listings posted from the Mini App's "+" button. The poster gets a Seller row of their own
 * (linked by telegramUserId) so their products rank in /recommend like everyone else's.
 */
import type { Buyer } from "@prisma/client";
import { prisma } from "./db.js";
import { PROVINCES } from "./geo.js";
import { normalize, resolveProduct } from "./products.js";

export class ListingError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export interface ListingInput { name: string; category?: string; price: number; minOrder?: number; province?: string; place?: string; loc?: { lat: number; lng: number } | null; photo?: string | null; shopName?: string }

/** Slug for products that are not in the catalog: "LED lampa" → "led-lampa". */
export const customKey = (name: string) => "x-" + normalize(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40);

/** The poster's own shop, created on first post. */
export async function ownSeller(buyer: Buyer, input: Partial<ListingInput> = {}) {
  const existing = await prisma.seller.findFirst({ where: { telegramUserId: buyer.telegramUserId } });
  const prov = PROVINCES.find((p) => p.key === input.province) ?? PROVINCES[0];
  const data = {
    name: input.shopName || buyer.name || "Mening do'konim",
    region: input.place || prov.label.uz,
    province: prov.key,
    bazaar: input.place || prov.label.uz,
    lat: input.loc?.lat ?? prov.lat,
    lng: input.loc?.lng ?? prov.lng,
  };
  if (existing) return input.province || input.place || input.loc ? prisma.seller.update({ where: { id: existing.id }, data }) : existing;
  return prisma.seller.create({ data: { ...data, telegramUserId: buyer.telegramUserId, verified: false, rating: 0, reviewCount: 0 } });
}

export async function createOwnListing(buyer: Buyer, input: ListingInput) {
  if (!input.name?.trim()) throw new ListingError(400, "name is required");
  if (!Number.isFinite(input.price) || input.price <= 0) throw new ListingError(400, "price must be positive");
  const seller = await ownSeller(buyer, input);
  const catalogKey = resolveProduct(input.name);
  const product = catalogKey ?? customKey(input.name);
  const now = new Date();
  const listing = await prisma.listing.create({ data: { sellerId: seller.id, product, title: catalogKey ? null : input.name.trim(), pricePerKg: Math.round(input.price), minOrderKg: Math.max(1, Math.round(input.minOrder ?? 1)), photoUrl: input.photo || null, reportedAt: now } });
  await prisma.priceHistory.create({ data: { sellerId: seller.id, product, region: seller.province, price: listing.pricePerKg, reportedAt: now } });
  return { listing, seller, product, catalogKey };
}

export async function updateOwnListing(buyer: Buyer, id: number, input: Partial<ListingInput>) {
  const l = await prisma.listing.findUnique({ where: { id }, include: { seller: true } });
  if (!l || l.seller.telegramUserId !== buyer.telegramUserId) throw new ListingError(404, "listing not found");
  if (input.province || input.place || input.loc) await ownSeller(buyer, input);
  const catalogKey = input.name ? resolveProduct(input.name) : null;
  const product = input.name ? (catalogKey ?? customKey(input.name)) : l.product;
  const price = input.price != null ? Math.round(input.price) : l.pricePerKg;
  const listing = await prisma.listing.update({ where: { id }, data: { product, title: input.name ? (catalogKey ? null : input.name.trim()) : l.title, pricePerKg: price, ...(input.photo !== undefined ? { photoUrl: input.photo || null } : {}), reportedAt: new Date() } });
  if (price !== l.pricePerKg) await prisma.priceHistory.create({ data: { sellerId: l.sellerId, product, region: l.seller.province, price, reportedAt: new Date() } });
  return { listing, product, catalogKey };
}

export async function deleteOwnListing(buyer: Buyer, id: number) {
  const l = await prisma.listing.findUnique({ where: { id }, include: { seller: true } });
  if (!l || l.seller.telegramUserId !== buyer.telegramUserId) throw new ListingError(404, "listing not found");
  await prisma.buyerInteraction.deleteMany({ where: { listingId: id } });
  await prisma.deal.deleteMany({ where: { listingId: id, status: { in: ["offered", "countered", "declined"] } } });
  const openDeals = await prisma.deal.count({ where: { listingId: id } });
  if (openDeals) throw new ListingError(409, "this listing has accepted deals and cannot be deleted");
  await prisma.listing.delete({ where: { id } });
}

/** The buyer's own latest listing for a product — pinned at the top of their search results. */
export async function ownListingFor(buyer: Buyer, product: string) {
  const l = await prisma.listing.findFirst({ where: { product, seller: { telegramUserId: buyer.telegramUserId } }, orderBy: { reportedAt: "desc" }, include: { seller: true } });
  return l ? { listingId: l.id, sellerId: l.sellerId, sellerName: l.seller.name, region: l.seller.region, pricePerKg: l.pricePerKg, minOrderKg: l.minOrderKg, photoUrl: l.photoUrl, title: l.title, reportedAt: l.reportedAt } : null;
}

/** Custom (non-catalog) products: find one by name so searches for "LED lampa" work. */
export async function resolveCustomProduct(query: string): Promise<{ key: string; title: string } | null> {
  const n = normalize(query);
  if (!n) return null;
  const key = customKey(query);
  const l = await prisma.listing.findFirst({ where: { OR: [{ product: key }, { title: { contains: query.trim() } }], seller: { suspended: false } }, orderBy: { reportedAt: "desc" } });
  return l ? { key: l.product, title: l.title ?? query.trim() } : null;
}
