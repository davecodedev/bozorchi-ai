/**
 * Platform admin API (the whole project, not one bazaar): KPIs, users, sellers, listings, deals,
 * revenue, activity log, settings. Guarded by ADMIN_PASSWORD (header x-admin-key or ?key=).
 */
import type { NextFunction, Request, Response } from "express";
import { calculateCommission } from "./commission.js";
import { prisma } from "./db.js";
import { productLabel as _productLabel, PRODUCTS } from "./products.js";
import { PROVINCES } from "./geo.js";
/** English label for admin tables (falls back to the key). */
const productLabel = (key: string) => _productLabel(key)?.en ?? key;
export const adminCatalog = () => ({ products: PRODUCTS.map((p) => ({ key: p.key, label: p.label.en, category: p.category })), provinces: PROVINCES.map((p) => ({ key: p.key, label: p.label.en })) });
import { computeReliabilityBulk } from "./reliability.js";
import { DEFAULT_SETTINGS, getSettings, setSetting, type PlatformSettings } from "./settings.js";
import { liveTiers, setTier, type Tier } from "./tiers.js";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD.includes("FAKE") ? process.env.ADMIN_PASSWORD : "admin";
if (ADMIN_PASSWORD === "admin") console.warn("ADMIN_PASSWORD not set — the admin panel uses the default password 'admin' (fine for a demo, not for production).");

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-admin-key") || (req.query.key as string | undefined);
  if (key !== ADMIN_PASSWORD) return res.status(401).json({ error: "admin key required" });
  next();
}

const WINDOWS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, all: 3650 };
const sinceOf = (w: string) => new Date(Date.now() - (WINDOWS[w] ?? 7) * 86_400_000);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function adminStats(window = "7d") {
  const since = sinceOf(window);
  const tiers = await liveTiers();
  const [buyers, newBuyers, byTier, sellers, suspended, listings, deals, unlocks, events] = await Promise.all([
    prisma.buyer.count(), prisma.buyer.count({ where: { createdAt: { gte: since } } }),
    prisma.buyer.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.seller.count(), prisma.seller.count({ where: { suspended: true } }), prisma.listing.count(),
    prisma.deal.findMany({ where: { updatedAt: { gte: since } }, select: { status: true, totalValue: true, commissionAmt: true, updatedAt: true } }),
    prisma.contactUnlock.count({ where: { unlockedAt: { gte: since } } }),
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const active = await prisma.buyer.count({ where: { lastSeenAt: { gte: since } } });
  const accepted = deals.filter((d) => d.status === "accepted");
  const gmv = accepted.reduce((a, d) => a + (d.totalValue ?? 0), 0);
  const commission = accepted.reduce((a, d) => a + (d.commissionAmt ?? 0), 0);
  const tierCount = (t: Tier) => byTier.find((x) => x.tier === t)?._count._all ?? 0;
  const mrrUsd = tierCount("pro") * tiers.pro.priceUsd + tierCount("max") * tiers.max.priceUsd;
  // daily series for the window: deals GMV + commission + signups + AI calls
  const days = Math.min(WINDOWS[window] ?? 7, 90);
  const series: Record<string, { gmv: number; commission: number; deals: number; signups: number; ai: number; searches: number }> = {};
  for (let i = days - 1; i >= 0; i--) series[dayKey(new Date(Date.now() - i * 86_400_000))] = { gmv: 0, commission: 0, deals: 0, signups: 0, ai: 0, searches: 0 };
  for (const d of accepted) { const k = dayKey(d.updatedAt); if (series[k]) { series[k].gmv += d.totalValue ?? 0; series[k].commission += d.commissionAmt ?? 0; series[k].deals += 1; } }
  const signupRows = await prisma.buyer.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  for (const r of signupRows) { const k = dayKey(r.createdAt); if (series[k]) series[k].signups += 1; }
  const evRows = await prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { type: true, createdAt: true } });
  for (const e of evRows) { const k = dayKey(e.createdAt); if (!series[k]) continue; if (["parse", "assistant", "transcribe", "verify"].includes(e.type)) series[k].ai += 1; if (e.type === "search") series[k].searches += 1; }
  const eventCounts = Object.fromEntries(events.map((e) => [e.type, e._count._all]));
  return {
    window, since,
    users: { total: buyers, new: newBuyers, active, byTier: { free: tierCount("free"), pro: tierCount("pro"), max: tierCount("max") } },
    sellers: { total: sellers, suspended, listings },
    deals: { total: deals.length, accepted: accepted.length, declined: deals.filter((d) => d.status === "declined").length, open: deals.filter((d) => d.status === "offered" || d.status === "countered").length, gmv, commission },
    revenue: { commissionUzs: commission, mrrUsd, subscriptions: { pro: tierCount("pro"), max: tierCount("max") } },
    unlocks,
    ai: { parse: eventCounts.parse ?? 0, assistant: eventCounts.assistant ?? 0, transcribe: eventCounts.transcribe ?? 0, verify: eventCounts.verify ?? 0, total: (eventCounts.parse ?? 0) + (eventCounts.assistant ?? 0) + (eventCounts.transcribe ?? 0) + (eventCounts.verify ?? 0) },
    events: eventCounts,
    series: Object.entries(series).map(([day, v]) => ({ day, ...v })),
  };
}

export async function adminUsers(q: { search?: string; tier?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, q.page ?? 1), pageSize = Math.min(100, q.pageSize ?? 25);
  const where = { ...(q.tier ? { tier: q.tier } : {}), ...(q.search ? { OR: [{ name: { contains: q.search } }, { username: { contains: q.search } }, { telegramUserId: { contains: q.search } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.buyer.count({ where }),
    prisma.buyer.findMany({ where, orderBy: { lastSeenAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { unlocks: true, deals: true, interactions: true } } } }),
  ]);
  const ids = rows.map((r) => r.id);
  const spend = ids.length ? await prisma.deal.groupBy({ by: ["buyerId"], where: { buyerId: { in: ids }, status: "accepted" }, _sum: { totalValue: true, commissionAmt: true } }) : [];
  return { total, page, pageSize, users: rows.map((r) => ({ id: r.id, telegramUserId: r.telegramUserId, name: r.name, username: r.username, tier: r.tier, verifiedBuyer: r.verifiedBuyer, banned: r.banned, createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, unlocks: r._count.unlocks, deals: r._count.deals, gmv: spend.find((s) => s.buyerId === r.id)?._sum.totalValue ?? 0 })) };
}

export async function adminUpdateUser(id: number, patch: { tier?: Tier; verifiedBuyer?: boolean; banned?: boolean }) {
  if (patch.tier) await setTier(id, patch.tier);
  const data: Record<string, unknown> = {};
  if (typeof patch.banned === "boolean") data.banned = patch.banned;
  if (typeof patch.verifiedBuyer === "boolean") data.verifiedBuyer = patch.verifiedBuyer;
  return Object.keys(data).length ? prisma.buyer.update({ where: { id }, data }) : prisma.buyer.findUniqueOrThrow({ where: { id } });
}

export async function adminSellers(q: { search?: string; province?: string; page?: number; pageSize?: number; suspended?: boolean }) {
  const page = Math.max(1, q.page ?? 1), pageSize = Math.min(100, q.pageSize ?? 25);
  const where = { ...(q.province ? { province: q.province } : {}), ...(typeof q.suspended === "boolean" ? { suspended: q.suspended } : {}), ...(q.search ? { OR: [{ name: { contains: q.search } }, { bazaar: { contains: q.search } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.seller.count({ where }),
    prisma.seller.findMany({ where, orderBy: { rating: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { listings: true, deals: true, reviews: true } } } }),
  ]);
  const ids = rows.map((r) => r.id);
  const [rel, rev] = await Promise.all([computeReliabilityBulk(ids), ids.length ? prisma.deal.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: "accepted" }, _sum: { totalValue: true, commissionAmt: true } }) : []]);
  return { total, page, pageSize, sellers: rows.map((r) => ({ id: r.id, name: r.name, bazaar: r.bazaar, region: r.region, province: r.province, rating: r.rating, verified: r.verified, suspended: r.suspended, listings: r._count.listings, deals: r._count.deals, reviews: r._count.reviews, reliability: rel.get(r.id)?.tier ?? "new", score: rel.get(r.id)?.score ?? 0, revenue: rev.find((x) => x.sellerId === r.id)?._sum.totalValue ?? 0 })) };
}

export async function adminListings(q: { search?: string; product?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, q.page ?? 1), pageSize = Math.min(100, q.pageSize ?? 25);
  const where = { ...(q.product ? { product: q.product } : {}), ...(q.search ? { OR: [{ product: { contains: q.search } }, { seller: { name: { contains: q.search } } }] } : {}) };
  const [total, rows] = await Promise.all([prisma.listing.count({ where }), prisma.listing.findMany({ where, orderBy: { reportedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { seller: { select: { id: true, name: true, bazaar: true, suspended: true } } } })]);
  return { total, page, pageSize, listings: rows.map((l) => ({ id: l.id, product: l.product, label: productLabel(l.product), pricePerKg: l.pricePerKg, minOrderKg: l.minOrderKg, photoUrl: l.photoUrl, reportedAt: l.reportedAt, seller: l.seller })) };
}

export async function adminDeals(q: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, q.page ?? 1), pageSize = Math.min(100, q.pageSize ?? 25);
  const where = q.status ? { status: q.status } : {};
  const [total, rows] = await Promise.all([prisma.deal.count({ where }), prisma.deal.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { listing: { select: { product: true } }, buyer: { select: { id: true, name: true, telegramUserId: true, tier: true } }, seller: { select: { id: true, name: true } } } })]);
  return { total, page, pageSize, deals: rows.map((d) => ({ id: d.id, status: d.status, product: d.listing.product, label: productLabel(d.listing.product), quantity: d.quantity, initialOffer: d.initialOffer, counterOffer: d.counterOffer, agreedPrice: d.agreedPrice, totalValue: d.totalValue, commission: d.totalValue != null ? calculateCommission(d.totalValue) : null, buyer: d.buyer, seller: d.seller, createdAt: d.createdAt, updatedAt: d.updatedAt })) };
}

export async function adminEvents(q: { type?: string; limit?: number }) {
  const rows = await prisma.event.findMany({ where: q.type ? { type: q.type } : {}, orderBy: { createdAt: "desc" }, take: Math.min(500, q.limit ?? 100) });
  const buyerIds = [...new Set(rows.map((r) => r.buyerId).filter((x): x is number => x != null))];
  const buyers = buyerIds.length ? await prisma.buyer.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true, telegramUserId: true } }) : [];
  return rows.map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt, buyer: buyers.find((b) => b.id === r.buyerId) ?? null, sellerId: r.sellerId, meta: r.meta ? JSON.parse(r.meta) : null }));
}

export { getSettings, setSetting, DEFAULT_SETTINGS };
export type { PlatformSettings };
