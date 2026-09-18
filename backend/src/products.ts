/**
 * Canonical product keys and the aliases buyers type (Uzbek Latin, Uzbek Cyrillic,
 * Russian, English). Listing.product always stores the canonical key.
 */
export interface ProductDef {
  key: string;
  label: { uz: string; ru: string; en: string };
  aliases: string[];
}

export const PRODUCTS: ProductDef[] = [
  {
    key: "tomato",
    label: { uz: "Pomidor", ru: "Помидор", en: "Tomato" },
    aliases: ["tomato", "tomatoes", "pomidor", "pomidorlar", "помидор", "помидоры", "томат", "томаты"],
  },
  {
    key: "potato",
    label: { uz: "Kartoshka", ru: "Картофель", en: "Potato" },
    aliases: ["potato", "potatoes", "kartoshka", "kartoshkalar", "картошка", "картофель"],
  },
  {
    key: "onion",
    label: { uz: "Piyoz", ru: "Лук", en: "Onion" },
    aliases: ["onion", "onions", "piyoz", "пиёз", "лук", "лук репчатый"],
  },
];

const ALIAS_INDEX = new Map<string, string>();
for (const p of PRODUCTS) {
  ALIAS_INDEX.set(p.key, p.key);
  for (const a of p.aliases) ALIAS_INDEX.set(normalize(a), p.key);
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[’'`ʻ]/g, "").replace(/\s+/g, " ");
}

/** Resolve free text ("Pomidor", "помидоры", "tomato") to a canonical key, or null. */
export function resolveProduct(input: string): string | null {
  const n = normalize(input);
  if (ALIAS_INDEX.has(n)) return ALIAS_INDEX.get(n)!;
  // fall back to "contains" so "2 tonna pomidor kerak" still resolves
  for (const [alias, key] of ALIAS_INDEX) {
    if (alias.length >= 3 && n.includes(alias)) return key;
  }
  return null;
}

export function productLabel(key: string): ProductDef["label"] | undefined {
  return PRODUCTS.find((p) => p.key === key)?.label;
}
