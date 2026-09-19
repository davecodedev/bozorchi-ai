/**
 * Market price chart for a product in a region: 30 days of history + 7-day forecast, as JSON for
 * the Mini App and as a PNG (SVG rendered with resvg) for the Telegram bot.
 */
import { Resvg } from "@resvg/resvg-js";
import { fitTrend, marketDailyPrices, FORECAST_WINDOW_DAYS } from "./forecast.js";
import { resolveProvince } from "./geo.js";
import { forecast } from "./history.js";
import { productLabel } from "./products.js";

export interface MarketView {
  product: string;
  label: { uz: string; ru: string; en: string } | undefined;
  province: string;
  provinceLabel: { uz: string; ru: string; en: string } | undefined;
  days: number;
  series: { day: number; price: number; sellers: number }[];
  current: number | null;
  changePct: number | null;
  trend: ReturnType<typeof fitTrend>;
  forecast: ReturnType<typeof forecast> | null;
  seeded: true;
}

export async function marketView(product: string, provinceKey = "toshkent-shahri"): Promise<MarketView> {
  const prov = resolveProvince(provinceKey);
  const key = prov?.key ?? "toshkent-shahri";
  const series = await marketDailyPrices(product, key, FORECAST_WINDOW_DAYS);
  const prices = series.map((s) => s.price);
  const current = prices.length ? prices[prices.length - 1] : null;
  const first = prices.length ? prices[0] : null;
  return {
    product, label: productLabel(product), province: key, provinceLabel: prov?.label, days: FORECAST_WINDOW_DAYS,
    series, current, changePct: current != null && first ? Math.round(((current - first) / first) * 100) : null,
    trend: fitTrend(series, FORECAST_WINDOW_DAYS),
    forecast: prices.length >= 5 ? forecast(prices) : null,
    seeded: true,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Chart as SVG, styled like the Mini App. lang picks the labels. */
export function marketChartSvg(m: MarketView, lang: "uz" | "ru" | "en" = "uz"): string {
  const W = 800, H = 460, L = 70, R = 24, T = 96, B = 60;
  const font = "Manrope, Helvetica, Arial, sans-serif";
  const hist = m.series.map((s) => s.price);
  const fc = m.forecast?.points ?? [];
  const all = hist.concat(fc);
  if (all.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#F5F6FA"/><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="${font}" font-size="22" fill="#5B6072">No price history yet</text></svg>`;
  }
  const min = Math.min(...all) * 0.97, max = Math.max(...all) * 1.03;
  const n = all.length;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fpts = fc.length ? [hist.length - 1, ...fc.map((_, i) => hist.length + i)].map((i) => `${x(i).toFixed(1)},${y(all[i]).toFixed(1)}`).join(" ") : "";
  const title = `${m.label?.[lang] ?? m.product} · ${m.provinceLabel?.[lang] ?? m.province}`;
  const L_ = { uz: { now: "bugun", ago: "30 kun oldin", next: "kelasi hafta", vs: "30 kun oldingiga nisbatan", fc: "7 kunlik prognoz", per: "so'm/kg", unit: "so'm/kg" }, ru: { now: "сегодня", ago: "30 дней назад", next: "след. неделя", vs: "к 30 дням назад", fc: "прогноз на 7 дней", per: "сум/кг", unit: "сум/кг" }, en: { now: "today", ago: "30 days ago", next: "next week", vs: "vs 30 days ago", fc: "7-day forecast", per: "so'm/kg", unit: "so'm/kg" } }[lang];
  const chg = m.changePct ?? 0;
  const chgColor = chg > 0 ? "#C23B32" : chg < 0 ? "#1F8F4E" : "#5B6072";
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
  const grid = gridVals.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#E2E4EC" stroke-dasharray="4 4"/><text x="${L - 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-family="${font}" font-size="13" fill="#5B6072">${fmt(v)}</text>`).join("");
  const fcBand = fc.length ? `<rect x="${x(hist.length - 1).toFixed(1)}" y="${T}" width="${(W - R - x(hist.length - 1)).toFixed(1)}" height="${H - T - B}" fill="#F7C94C" fill-opacity=".14"/>` : "";
  const fcLine = fpts ? `<polyline points="${fpts}" fill="none" stroke="#E08A1E" stroke-width="4" stroke-dasharray="9 7" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(n - 1).toFixed(1)}" cy="${y(all[n - 1]).toFixed(1)}" r="6" fill="#E08A1E"/>` : "";
  const fcLabel = m.forecast ? `<text x="${W - R}" y="${T - 12}" text-anchor="end" font-family="${font}" font-size="14" font-weight="700" fill="#E08A1E">${esc(L_.fc)}: ${fmt(fc[fc.length - 1])} ${L_.per} (${m.forecast.pct > 0 ? "+" : ""}${m.forecast.pct}%)</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${font}">
  <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3E5CF6" stop-opacity=".28"/><stop offset="1" stop-color="#3E5CF6" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" rx="24" fill="#FFFFFF"/>
  <text x="${L}" y="40" font-size="24" font-weight="800" fill="#1B1D2E">${esc(title)}</text>
  <text x="${L}" y="70" font-size="30" font-weight="800" fill="#1B1D2E">${m.current != null ? fmt(m.current) : "—"}<tspan font-size="15" font-weight="600" fill="#5B6072"> ${L_.unit} ${L_.now}</tspan></text>
  <text x="${L + 300}" y="70" font-size="16" font-weight="700" fill="${chgColor}">${chg > 0 ? "▲ +" : chg < 0 ? "▼ " : "■ "}${chg}% ${esc(L_.vs)}</text>
  ${grid}${fcBand}
  <polygon points="${x(0).toFixed(1)},${(H - B).toFixed(1)} ${pts} ${x(hist.length - 1).toFixed(1)},${(H - B).toFixed(1)}" fill="url(#g)"/>
  <polyline points="${pts}" fill="none" stroke="#3E5CF6" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${x(hist.length - 1).toFixed(1)}" cy="${y(hist[hist.length - 1]).toFixed(1)}" r="6" fill="#3E5CF6"/>
  ${fcLine}${fcLabel}
  <text x="${L}" y="${H - 22}" font-size="13" fill="#5B6072">${esc(L_.ago)}</text>
  <text x="${x(hist.length - 1).toFixed(1)}" y="${H - 22}" text-anchor="${fc.length ? "middle" : "end"}" font-size="13" fill="#5B6072">${esc(L_.now)}</text>
  ${fc.length ? `<text x="${W - R}" y="${H - 22}" text-anchor="end" font-size="13" fill="#E08A1E">${esc(L_.next)}</text>` : ""}
</svg>`;
}

export function marketChartPng(m: MarketView, lang: "uz" | "ru" | "en" = "uz"): Buffer {
  return new Resvg(marketChartSvg(m, lang), { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true } }).render().asPng();
}
