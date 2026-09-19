/** Thin client for the Bozorchi AI backend. */
export interface RecommendParams {
  product: string;
  region?: string;
  quantityKg?: number;
  lat?: number;
  lng?: number;
  limit?: number;
}

export interface Result {
  rank: number;
  score: number;
  sellerId: number;
  sellerName: string;
  bazaar: string;
  region: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  pricePerKg: number;
  distanceKm: number;
  aiPick: boolean;
  reportedDaysAgo: number;
  breakdown: { priceScore: number; qualityScore: number; distanceScore: number };
  reliability?: { score: number; tier: string };
}

export interface RecommendResponse {
  product: string;
  unit?: "kg" | "l" | "dona" | "qop" | "m";
  province?: string | null;
  label: { uz: string; ru: string; en: string };
  candidates: number;
  results: Result[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

export type Tier = "free" | "pro" | "max";
export interface Usage { tier: Tier; quota: number; used: number; remaining: number; unlimited: boolean; verifiedBuyer: boolean; prices: Record<Tier, number> }

export interface Caller { telegramUserId: number | string; name?: string }

export async function recommend(
  backendUrl: string,
  params: RecommendParams,
  caller?: Caller,
): Promise<RecommendResponse & { usage?: Usage }> {
  const res = await fetch(`${backendUrl}/recommend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(caller ? { "x-telegram-user-id": String(caller.telegramUserId), ...(caller.name ? { "x-telegram-user-name": encodeURIComponent(caller.name) } : {}) } : {}),
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body as Record<string, unknown>);
  return body as RecommendResponse;
}

export interface ParsedQuery {
  available: boolean;
  product: string | null;
  quantity: number | null;
  unit: string | null;
  region: string | null;
  productKey: string | null;
  quantityKg: number | null;
}

/** Ask the backend's LLM parser to structure a raw message. Never throws — degrades to `available: false`. */
export async function parse(backendUrl: string, text: string): Promise<ParsedQuery> {
  const nothing: ParsedQuery = { available: false, product: null, quantity: null, unit: null, region: null, productKey: null, quantityKg: null };
  try {
    const res = await fetch(`${backendUrl}/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return nothing;
    return { ...nothing, ...((await res.json()) as Partial<ParsedQuery>) };
  } catch {
    return nothing;
  }
}

export interface Contact { sellerId: number; sellerName: string; phone: string | null; bazaar: string; region: string; lat: number; lng: number; mapsUrl: string }
export type UnlockResult =
  | { status: "unlocked" | "already_unlocked"; contact: Contact; usage: Usage; sellerNotice: string; sellerTelegramUserId: string | null; verifiedBuyer: boolean }
  | { status: "quota_exceeded"; tier: Tier; quota: number; usage: Usage; next: { tier: Tier; quota: number; priceUsd: number } | null };

const callerHeaders = (caller?: Caller) =>
  caller ? { "x-telegram-user-id": String(caller.telegramUserId), ...(caller.name ? { "x-telegram-user-name": encodeURIComponent(caller.name) } : {}) } : {};

/** Reveal a seller's contact against the buyer's monthly quota. 402 = quota_exceeded (still a valid result). */
export async function unlockContact(backendUrl: string, sellerId: number, caller?: Caller): Promise<UnlockResult> {
  const res = await fetch(`${backendUrl}/sellers/${sellerId}/unlock`, { method: "POST", headers: { "content-type": "application/json", ...callerHeaders(caller) }, signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => ({}))) as UnlockResult & { error?: string };
  if (!res.ok && res.status !== 402) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body;
}

/** Mock upgrade for the demo. */
export async function setTier(backendUrl: string, tier: Tier, caller?: Caller): Promise<{ tier: Tier; verifiedBuyer: boolean; usage: Usage }> {
  const res = await fetch(`${backendUrl}/me/upgrade`, { method: "POST", headers: { "content-type": "application/json", ...callerHeaders(caller) }, body: JSON.stringify({ tier }), signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => ({}))) as { tier: Tier; verifiedBuyer: boolean; usage: Usage; error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body;
}

/** Market chart PNG for a product (history + forecast). */
export async function marketChart(backendUrl: string, product: string, province: string | undefined, lang: string): Promise<{ png: Buffer; view: { current: number | null; changePct: number | null; trend: { direction: string; changePercent: number }; forecast: { pct: number; verdict: string; points: number[] } | null; label?: Record<string, string>; provinceLabel?: Record<string, string> } }> {
  const q = `?province=${encodeURIComponent(province ?? "toshkent-shahri")}&lang=${lang}`;
  const [pngRes, jsonRes] = await Promise.all([
    fetch(`${backendUrl}/market/${encodeURIComponent(product)}.png${q}`, { signal: AbortSignal.timeout(15_000) }),
    fetch(`${backendUrl}/market/${encodeURIComponent(product)}${q}`, { signal: AbortSignal.timeout(15_000) }),
  ]);
  if (!pngRes.ok || !jsonRes.ok) throw new ApiError(pngRes.status, "chart failed");
  return { png: Buffer.from(await pngRes.arrayBuffer()), view: (await jsonRes.json()) as never };
}
