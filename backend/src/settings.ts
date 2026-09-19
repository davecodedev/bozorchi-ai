/** Admin-editable settings with a short cache. Defaults live in code; the Setting table overrides them. */
import { prisma } from "./db.js";

export interface PlatformSettings {
  tiers: { free: { quota: number; priceUsd: number }; pro: { quota: number; priceUsd: number }; max: { quota: number; priceUsd: number } };
  features: { assistant: boolean; voice: boolean; deals: boolean; verification: boolean; demoSellerActions: boolean };
  commissionEnabled: boolean;
  /** Flat platform fees shown to buyers before they open a deal or reveal a contact (UZS). */
  fees: { dealOpenUzs: number; contactUzs: number };
  announcement: string; // shown in the Mini App if non-empty
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  tiers: { free: { quota: 3, priceUsd: 0 }, pro: { quota: 20, priceUsd: 7 }, max: { quota: 500, priceUsd: 79 } },
  features: { assistant: true, voice: true, deals: true, verification: true, demoSellerActions: true },
  commissionEnabled: true,
  fees: { dealOpenUzs: 10_000, contactUzs: 5_000 },
  announcement: "",
};

let cache: { at: number; value: PlatformSettings } | null = null;
const TTL = 5_000;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const rows = await prisma.setting.findMany();
  const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Record<string, unknown>;
  for (const r of rows) {
    try { merged[r.key] = deepMerge(merged[r.key], JSON.parse(r.value)); } catch { /* ignore bad rows */ }
  }
  cache = { at: Date.now(), value: merged as unknown as PlatformSettings };
  return cache.value;
}

export async function setSetting<K extends keyof PlatformSettings>(key: K, value: Partial<PlatformSettings[K]> | PlatformSettings[K]) {
  const current = (await getSettings())[key];
  const next = deepMerge(current, value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  cache = null;
  return next;
}

function deepMerge(a: unknown, b: unknown): unknown {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = deepMerge(out[k], v);
    return out;
  }
  return b === undefined ? a : b;
}

/** Last settings we loaded (or the defaults) — for sync call sites; refreshes in the background. */
export function cachedSettings(): PlatformSettings {
  if (!cache || Date.now() - cache.at > TTL) getSettings().catch(() => {});
  return cache?.value ?? DEFAULT_SETTINGS;
}
