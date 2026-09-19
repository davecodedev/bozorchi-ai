/**
 * Deal negotiation: buyer offers → seller counters (once) / accepts / declines → buyer accepts or
 * declines the counter. "accepted" computes the commission and reveals contact without touching
 * the buyer's unlock quota. Payment itself happens between the parties for now (mocked).
 *
 * State machine (the only transitions allowed; anything else → DealError 409):
 *   offered   → countered (seller, once) | accepted (seller) | declined (either)
 *   countered → accepted (buyer)          | declined (buyer)
 */
import type { Deal } from "@prisma/client";
import { calculateCommission, type Commission } from "./commission.js";
import { contactOf, type Contact } from "./contactUnlock.js";
import { prisma } from "./db.js";
import { productLabel, productUnit } from "./products.js";

export type DealStatus = "offered" | "countered" | "accepted" | "declined";
export type Actor = "buyer" | "seller";

export class DealError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const dealInclude = { listing: true, seller: true, buyer: { select: { id: true, telegramUserId: true, name: true, verifiedBuyer: true } } } as const;

export async function createDeal(buyerTelegramUserId: string, input: { listingId: number; quantity: number; pricePerKg: number }) {
  const buyer = await prisma.buyer.upsert({ where: { telegramUserId: buyerTelegramUserId }, create: { telegramUserId: buyerTelegramUserId }, update: {} });
  const listing = await prisma.listing.findUnique({ where: { id: Number(input.listingId) }, include: { seller: true } });
  if (!listing) throw new DealError(404, "listing not found");
  const quantity = Number(input.quantity), price = Number(input.pricePerKg);
  if (!(quantity > 0)) throw new DealError(400, "quantity must be > 0");
  if (quantity < listing.minOrderKg) throw new DealError(400, `minimum order for this listing is ${listing.minOrderKg} kg`);
  if (!(price > 0)) throw new DealError(400, "pricePerKg must be > 0");
  return prisma.deal.create({
    data: { listingId: listing.id, buyerId: buyer.id, sellerId: listing.sellerId, quantity, status: "offered", initialOffer: price },
    include: dealInclude,
  });
}

async function load(id: string) {
  const d = await prisma.deal.findUnique({ where: { id }, include: dealInclude });
  if (!d) throw new DealError(404, "deal not found");
  return d;
}

/** Seller's ONE counter. Only from "offered"; a second counter is refused at the API level. */
export async function counterDeal(id: string, pricePerKg: number) {
  const d = await load(id);
  if (d.status === "countered") throw new DealError(409, "only one counter-offer is allowed per deal — accept or decline instead");
  if (d.status !== "offered") throw new DealError(409, `cannot counter a deal that is ${d.status}`);
  const price = Number(pricePerKg);
  if (!(price > 0)) throw new DealError(400, "pricePerKg must be > 0");
  return prisma.deal.update({ where: { id }, data: { status: "countered", counterOffer: price }, include: dealInclude });
}

/** Seller accepts the initial offer (from "offered") or buyer accepts the counter (from "countered"). */
export async function acceptDeal(id: string, actor: Actor) {
  const d = await load(id);
  let agreed: number;
  if (d.status === "offered" && actor === "seller") agreed = d.initialOffer;
  else if (d.status === "countered" && actor === "buyer") agreed = d.counterOffer!;
  else if (d.status === "offered" && actor === "buyer") throw new DealError(409, "the seller has not responded yet");
  else if (d.status === "countered" && actor === "seller") throw new DealError(409, "waiting for the buyer to answer your counter-offer");
  else throw new DealError(409, `cannot accept a deal that is ${d.status}`);
  const totalValue = agreed * d.quantity;
  const c = calculateCommission(totalValue);
  return prisma.deal.update({ where: { id }, data: { status: "accepted", agreedPrice: agreed, totalValue, commissionAmt: c.totalCommission }, include: dealInclude });
}

export async function declineDeal(id: string, actor: Actor) {
  const d = await load(id);
  if (d.status === "accepted" || d.status === "declined") throw new DealError(409, `deal is already ${d.status}`);
  if (d.status === "countered" && actor === "seller") throw new DealError(409, "waiting for the buyer to answer your counter-offer");
  return prisma.deal.update({ where: { id }, data: { status: "declined" }, include: dealInclude });
}

export async function listDeals(buyerTelegramUserId: string) {
  const buyer = await prisma.buyer.findUnique({ where: { telegramUserId: buyerTelegramUserId }, select: { id: true } });
  if (!buyer) return [];
  return prisma.deal.findMany({ where: { buyerId: buyer.id }, include: dealInclude, orderBy: { updatedAt: "desc" }, take: 50 });
}

export async function getDeal(id: string) {
  return load(id);
}

type Loaded = Awaited<ReturnType<typeof load>>;

/** API shape: plain-language state, whose turn it is, commission breakdown and contact once accepted. */
export function presentDeal(d: Loaded, viewer: Actor = "buyer"): Record<string, unknown> & { commission: Commission | null; contact: Contact | null } {
  const status = d.status as DealStatus;
  const turn: Actor | null = status === "offered" ? "seller" : status === "countered" ? "buyer" : null;
  const commission = status === "accepted" && d.totalValue != null ? calculateCommission(d.totalValue) : null;
  return {
    id: d.id, status, turn, yourTurn: turn === viewer,
    listingId: d.listingId, product: d.listing.product, label: productLabel(d.listing.product), unit: productUnit(d.listing.product), photoUrl: d.listing.photoUrl, listPrice: d.listing.pricePerKg,
    seller: { id: d.seller.id, name: d.seller.name, bazaar: d.seller.bazaar, region: d.seller.region, verified: d.seller.verified, rating: d.seller.rating },
    buyer: { name: d.buyer.name, verifiedBuyer: d.buyer.verifiedBuyer },
    quantity: d.quantity, initialOffer: d.initialOffer, counterOffer: d.counterOffer, agreedPrice: d.agreedPrice, totalValue: d.totalValue,
    commissionAmt: d.commissionAmt, commission,
    contact: status === "accepted" ? contactOf(d.seller) : null,
    paymentNote: "offline", // payment happens between the parties for now — the app did not process money
    canCounter: status === "offered", // exactly one counter, ever
    createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
}

/** True when this caller may act as the seller on this deal (the seller's own Telegram account, or demo mode). */
export function mayActAsSeller(d: Pick<Deal, "sellerId"> & { seller: { telegramUserId: string | null } }, callerTelegramUserId: string): boolean {
  if (d.seller.telegramUserId && d.seller.telegramUserId === callerTelegramUserId) return true;
  return process.env.DEMO_SELLER_ACTIONS !== "0"; // sellers have no accounts yet — anyone may play the seller in the demo
}
