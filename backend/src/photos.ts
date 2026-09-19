/** Relevant product photos (Wikimedia Commons thumbnails, hotlink-safe). Regenerate with scripts/find-photos.mts. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PRODUCT_PHOTOS: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(here, "photos.json"), "utf8"));

/** A photo for this product; `variant` spreads sellers across the 3 pictures so results don't all look identical. */
export function photoFor(product: string, variant = 0): string | null {
  const list = PRODUCT_PHOTOS[product];
  if (!list || list.length === 0) return null;
  return list[Math.abs(variant) % list.length];
}
