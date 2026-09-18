/** Thin client for the Bozorchi AI backend. */
export interface RecommendParams {
  product: string;
  region?: string;
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
