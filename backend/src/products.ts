/**
 * Canonical product keys, categories, and the aliases buyers type (Uzbek Latin, Uzbek
 * Cyrillic, Russian, English). Listing.product always stores the canonical key.
 */
export type Category = "vegetables" | "fruits" | "meat" | "dairy" | "durable";

export interface ProductDef {
  key: string;
  category: Category;
  label: { uz: string; ru: string; en: string };
  aliases: string[];
}

export const CATEGORIES: { key: Category; label: { uz: string; ru: string; en: string } }[] = [
  { key: "vegetables", label: { uz: "Sabzavotlar", ru: "Овощи", en: "Vegetables" } },
  { key: "fruits", label: { uz: "Mevalar", ru: "Фрукты", en: "Fruits" } },
  { key: "meat", label: { uz: "Go'sht", ru: "Мясо", en: "Meat" } },
  { key: "dairy", label: { uz: "Sut mahsulotlari", ru: "Молочные", en: "Dairy" } },
  { key: "durable", label: { uz: "Uzoq saqlanadigan", ru: "Долгого хранения", en: "Durable goods" } },
];

export const PRODUCTS: ProductDef[] = [
  { key: "tomato", category: "vegetables", label: { uz: "Pomidor", ru: "Помидор", en: "Tomato" },
    aliases: ["tomato", "tomatoes", "pomidor", "pomidorlar", "помидор", "помидоры", "томат", "томаты"] },
  { key: "potato", category: "vegetables", label: { uz: "Kartoshka", ru: "Картофель", en: "Potato" },
    aliases: ["potato", "potatoes", "kartoshka", "kartoshkalar", "картошка", "картофель"] },
  { key: "onion", category: "vegetables", label: { uz: "Piyoz", ru: "Лук", en: "Onion" },
    aliases: ["onion", "onions", "piyoz", "пиёз", "лук", "лук репчатый"] },
  { key: "cucumber", category: "vegetables", label: { uz: "Bodring", ru: "Огурец", en: "Cucumber" },
    aliases: ["cucumber", "cucumbers", "bodring", "бодринг", "огурец", "огурцы"] },
  { key: "carrot", category: "vegetables", label: { uz: "Sabzi", ru: "Морковь", en: "Carrot" },
    aliases: ["carrot", "carrots", "sabzi", "сабзи", "морковь", "морковка"] },
  { key: "apple", category: "fruits", label: { uz: "Olma", ru: "Яблоко", en: "Apple" },
    aliases: ["apple", "apples", "olma", "олма", "яблоко", "яблоки"] },
  { key: "grape", category: "fruits", label: { uz: "Uzum", ru: "Виноград", en: "Grape" },
    aliases: ["grape", "grapes", "uzum", "узум", "виноград"] },
];

const ALIAS_INDEX = new Map<string, string>();
for (const p of PRODUCTS) {
  ALIAS_INDEX.set(p.key, p.key);
  for (const a of p.aliases) ALIAS_INDEX.set(normalize(a), p.key);
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[’'`ʻ]/g, "").replace(/\s+/g, " ");
}

/** Resolve free text ("Pomidor", "помидоры", "500 kg tomato") to a canonical key, or null. */
export function resolveProduct(input: string): string | null {
  const n = normalize(input);
  if (ALIAS_INDEX.has(n)) return ALIAS_INDEX.get(n)!;
  // fall back to "contains" so "2 tonna pomidor kerak" still resolves
  for (const [alias, key] of ALIAS_INDEX) {
    if (alias.length >= 3 && n.includes(alias)) return key;
  }
  return null;
}

export function productDef(key: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.key === key);
}

export function productLabel(key: string): ProductDef["label"] | undefined {
  return productDef(key)?.label;
}
