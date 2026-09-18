import type { RecommendResponse, Result } from "./api.js";
import type { Lang, Strings } from "./i18n.js";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtPrice = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");
const medal = (rank: number) => ["🥇", "🥈", "🥉"][rank - 1] ?? `${rank}.`;

export function formatResult(r: Result, s: Strings): string {
  const badges: string[] = [];
  if (r.aiPick) badges.push(`⭐ ${s.aiPick}`);
  if (r.verified) badges.push(`✅ ${s.verified}`);
  const badgeLine = badges.length ? `   ${badges.join(" · ")}\n` : "";

  return (
    `${medal(r.rank)} <b>${esc(r.sellerName)}</b> — ${esc(r.bazaar)}\n` +
    badgeLine +
    `   💰 <b>${fmtPrice(r.pricePerKg)}</b> ${s.perKg}` +
    `  ·  ⭐ ${r.rating.toFixed(1)} (${r.reviewCount})` +
    `  ·  📍 ${s.away(r.distanceKm)}\n` +
    `   🧮 ${s.score} <b>${r.score}</b> — ${s.breakdown(
      Math.round(r.breakdown.priceScore),
      Math.round(r.breakdown.qualityScore),
      Math.round(r.breakdown.distanceScore),
    )} · ${s.reported(r.reportedDaysAgo)}`
  );
}

export function formatRecommendation(
  data: RecommendResponse,
  lang: Lang,
  s: Strings,
  where: string,
): string {
  if (data.results.length === 0) return s.noResults;
  const label = data.label?.[lang] ?? data.product;
  return (
    s.header(esc(label), data.candidates, esc(where)) +
    "\n" +
    data.results.map((r) => formatResult(r, s)).join("\n\n")
  );
}
