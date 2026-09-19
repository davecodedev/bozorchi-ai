/** Fire-and-forget activity log. Never throws, never blocks the request. */
import { prisma } from "./db.js";

export type EventType = "search" | "parse" | "assistant" | "transcribe" | "verify" | "unlock" | "upgrade" | "deal_created" | "deal_countered" | "deal_accepted" | "deal_declined" | "feed" | "market" | "quote" | "listing_created";

export function logEvent(type: EventType, opts: { buyerId?: number | null; sellerId?: number | null; meta?: Record<string, unknown> } = {}) {
  prisma.event.create({ data: { type, buyerId: opts.buyerId ?? null, sellerId: opts.sellerId ?? null, meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 2000) : null } }).catch(() => {});
}
