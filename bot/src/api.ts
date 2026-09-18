/** Thin client for the Bazarcha backend. */
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
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function recommend(
  backendUrl: string,
  params: RecommendParams,
): Promise<RecommendResponse> {
  const res = await fetch(`${backendUrl}/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as RecommendResponse;
}
