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
}

export interface RecommendResponse {
  product: string;
  label: { uz: string; ru: string; en: string };
  candidates: number;
  results: Result[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

export interface Usage { tier: "standard" | "enterprise"; used: number; limit: number | null; credits: number; remaining: number | null }

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
