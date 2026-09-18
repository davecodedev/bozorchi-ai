/**
 * 30-day price series + 7-day forecast for one seller/product.
 * Until sellers report daily, the series is a deterministic sample ending at the real current
 * price (labelled as such in the UI). The forecast is a least-squares line over the last 14 days.
 */
export const HISTORY_DAYS = 30;
export const FORECAST_DAYS = 7;

export function sampleSeries(endPrice: number, seedStr: string): number[] {
  let seed = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const drift = (rnd() - 0.4) * 0.25;
  const pts = [1];
  for (let i = 1; i < HISTORY_DAYS; i++) pts.push(pts[i - 1] * (1 + (rnd() - 0.5) * 0.06 + drift / HISTORY_DAYS));
  const scale = endPrice / pts[pts.length - 1];
  return pts.map((p) => Math.round((p * scale) / 50) * 50);
}

export function forecast(series: number[], days = FORECAST_DAYS) {
  const window = series.slice(-14);
  const n = window.length;
  const xs = window.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = window.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (window[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const last = series[series.length - 1];
  const points = Array.from({ length: days }, (_, i) => Math.max(0, Math.round((last + slope * (i + 1)) / 50) * 50));
  const end = points[points.length - 1];
  const pct = Math.round(((end - last) / last) * 100);
  const verdict: "down" | "up" | "flat" = pct <= -3 ? "down" : pct >= 3 ? "up" : "flat";
  return { points, pct, verdict };
}
