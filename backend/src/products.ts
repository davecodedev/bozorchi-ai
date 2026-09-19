/**
 * Product catalog: 50 products across 12 categories — a bazaar sells far more than vegetables.
 * Each product has a unit (kg / l / dona / qop / m), labels in uz/ru/en and the aliases buyers type.
 * Listing.product always stores the canonical key; prices are "per unit".
 */
export type Category = "vegetables" | "fruits" | "meat" | "dairy" | "grains" | "spices" | "nuts" | "household" | "building" | "textiles" | "electronics" | "tools";
export type Unit = "kg" | "l" | "dona" | "qop" | "m";

export interface ProductDef {
  key: string;
  category: Category;
  unit: Unit;
  /** typical Tashkent price per unit, UZS — seed data spreads ±20% around it */
  basePrice: number;
  label: { uz: string; ru: string; en: string };
  aliases: string[];
}

export const CATEGORIES: { key: Category; label: { uz: string; ru: string; en: string } }[] = [
  { key: "vegetables", label: { uz: "Sabzavotlar", ru: "Овощи", en: "Vegetables" } },
  { key: "fruits", label: { uz: "Mevalar", ru: "Фрукты", en: "Fruits" } },
  { key: "meat", label: { uz: "Go'sht va tuxum", ru: "Мясо и яйца", en: "Meat & eggs" } },
  { key: "dairy", label: { uz: "Sut mahsulotlari", ru: "Молочные", en: "Dairy" } },
  { key: "grains", label: { uz: "Don va dukkaklilar", ru: "Крупы и бакалея", en: "Grains & staples" } },
  { key: "spices", label: { uz: "Ziravorlar", ru: "Специи", en: "Spices & herbs" } },
  { key: "nuts", label: { uz: "Yong'oq va quruq meva", ru: "Орехи и сухофрукты", en: "Nuts & dried fruit" } },
  { key: "household", label: { uz: "Uy-ro'zg'or", ru: "Хозтовары", en: "Household" } },
  { key: "building", label: { uz: "Qurilish", ru: "Стройматериалы", en: "Building materials" } },
  { key: "textiles", label: { uz: "Mato va kiyim", ru: "Ткани и одежда", en: "Textiles & clothing" } },
  { key: "electronics", label: { uz: "Elektronika", ru: "Электроника", en: "Electronics" } },
  { key: "tools", label: { uz: "Asboblar", ru: "Инструменты", en: "Tools & hardware" } },
];

export const UNIT_LABEL: Record<Unit, { uz: string; ru: string; en: string }> = {
  kg: { uz: "kg", ru: "кг", en: "kg" },
  l: { uz: "litr", ru: "л", en: "l" },
  dona: { uz: "dona", ru: "шт", en: "pc" },
  qop: { uz: "qop", ru: "мешок", en: "bag" },
  m: { uz: "metr", ru: "м", en: "m" },
};

const P = (key: string, category: Category, unit: Unit, basePrice: number, uz: string, ru: string, en: string, aliases: string[]): ProductDef =>
  ({ key, category, unit, basePrice, label: { uz, ru, en }, aliases: [key, ...aliases] });

export const PRODUCTS: ProductDef[] = [
  // ---- vegetables
  P("tomato", "vegetables", "kg", 13_000, "Pomidor", "Помидор", "Tomato", ["tomatoes", "pomidor", "pomidorlar", "помидор", "помидоры", "томат", "томаты"]),
  P("potato", "vegetables", "kg", 5_500, "Kartoshka", "Картофель", "Potato", ["potatoes", "kartoshka", "картошка", "картофель"]),
  P("onion", "vegetables", "kg", 4_500, "Piyoz", "Лук", "Onion", ["onions", "piyoz", "пиёз", "лук", "лук репчатый"]),
  P("cucumber", "vegetables", "kg", 9_000, "Bodring", "Огурец", "Cucumber", ["cucumbers", "bodring", "огурец", "огурцы"]),
  P("carrot", "vegetables", "kg", 5_000, "Sabzi", "Морковь", "Carrot", ["carrots", "sabzi", "морковь", "морковка"]),
  P("cabbage", "vegetables", "kg", 4_000, "Karam", "Капуста", "Cabbage", ["karam", "капуста"]),
  P("pepper", "vegetables", "kg", 12_000, "Bulg'or qalampiri", "Болгарский перец", "Bell pepper", ["bulgor", "bulg'or", "qalampir", "перец", "болгарский перец", "bell pepper", "peppers"]),
  P("eggplant", "vegetables", "kg", 7_000, "Baqlajon", "Баклажан", "Eggplant", ["baqlajon", "баклажан", "баклажаны", "aubergine"]),
  P("garlic", "vegetables", "kg", 25_000, "Sarimsoq", "Чеснок", "Garlic", ["sarimsoq", "чеснок"]),
  // ---- fruits
  P("apple", "fruits", "kg", 11_000, "Olma", "Яблоко", "Apple", ["apples", "olma", "яблоко", "яблоки"]),
  P("grape", "fruits", "kg", 15_000, "Uzum", "Виноград", "Grape", ["grapes", "uzum", "виноград"]),
  P("watermelon", "fruits", "kg", 3_500, "Tarvuz", "Арбуз", "Watermelon", ["tarvuz", "арбуз", "арбузы"]),
  P("melon", "fruits", "kg", 5_000, "Qovun", "Дыня", "Melon", ["qovun", "дыня", "дыни"]),
  P("pomegranate", "fruits", "kg", 18_000, "Anor", "Гранат", "Pomegranate", ["anor", "гранат", "гранаты"]),
  P("peach", "fruits", "kg", 14_000, "Shaftoli", "Персик", "Peach", ["peaches", "shaftoli", "персик", "персики"]),
  P("lemon", "fruits", "kg", 20_000, "Limon", "Лимон", "Lemon", ["lemons", "limon", "лимон", "лимоны"]),
  P("banana", "fruits", "kg", 22_000, "Banan", "Банан", "Banana", ["bananas", "banan", "банан", "бананы"]),
  // ---- meat & eggs
  P("beef", "meat", "kg", 95_000, "Mol go'shti", "Говядина", "Beef", ["mol goshti", "mol go'shti", "говядина", "мясо"]),
  P("lamb", "meat", "kg", 110_000, "Qo'y go'shti", "Баранина", "Lamb", ["qoy goshti", "qo'y go'shti", "баранина"]),
  P("chicken", "meat", "kg", 38_000, "Tovuq go'shti", "Курица", "Chicken", ["tovuq", "tovuq goshti", "курица", "куриное мясо"]),
  P("eggs", "meat", "dona", 1_600, "Tuxum", "Яйца", "Eggs", ["egg", "tuxum", "яйцо", "яйца"]),
  // ---- dairy
  P("milk", "dairy", "l", 12_000, "Sut", "Молоко", "Milk", ["sut", "молоко"]),
  P("qatiq", "dairy", "l", 14_000, "Qatiq", "Кефир", "Kefir", ["kefir", "qatiq", "кефир", "катык"]),
  P("cheese", "dairy", "kg", 80_000, "Pishloq", "Сыр", "Cheese", ["pishloq", "сыр"]),
  P("butter", "dairy", "kg", 90_000, "Sariyog'", "Сливочное масло", "Butter", ["sariyog", "sariyog'", "сливочное масло", "масло сливочное"]),
  // ---- grains & staples
  P("rice", "grains", "kg", 18_000, "Guruch", "Рис", "Rice", ["guruch", "рис", "lazer guruch"]),
  P("flour", "grains", "kg", 7_000, "Un", "Мука", "Flour", ["un", "мука", "bug'doy uni"]),
  P("chickpeas", "grains", "kg", 16_000, "No'xat", "Нут", "Chickpeas", ["noxat", "no'xat", "нут", "горох"]),
  P("sugar", "grains", "kg", 12_000, "Shakar", "Сахар", "Sugar", ["shakar", "qand", "сахар"]),
  P("oil", "grains", "l", 22_000, "Kungaboqar yog'i", "Подсолнечное масло", "Sunflower oil", ["yog", "yog'", "kungaboqar", "подсолнечное масло", "масло", "sunflower oil", "cooking oil"]),
  P("buckwheat", "grains", "kg", 22_000, "Grechka", "Гречка", "Buckwheat", ["grechka", "гречка", "гречневая крупа"]),
  // ---- spices & herbs
  P("cumin", "spices", "kg", 120_000, "Zira", "Зира", "Cumin", ["zira", "зира", "кумин"]),
  P("blackpepper", "spices", "kg", 150_000, "Qora murch", "Чёрный перец", "Black pepper", ["murch", "qora murch", "черный перец", "чёрный перец", "black pepper"]),
  P("paprika", "spices", "kg", 60_000, "Paprika", "Паприка", "Paprika", ["paprika", "паприка", "qizil qalampir"]),
  P("dill", "spices", "kg", 8_000, "Ukrop", "Укроп", "Dill", ["ukrop", "укроп", "shivit"]),
  // ---- nuts & dried fruit
  P("walnut", "nuts", "kg", 90_000, "Yong'oq", "Грецкий орех", "Walnuts", ["yongoq", "yong'oq", "грецкий орех", "орехи", "walnuts"]),
  P("almond", "nuts", "kg", 180_000, "Bodom", "Миндаль", "Almonds", ["bodom", "миндаль", "almonds"]),
  P("raisins", "nuts", "kg", 45_000, "Mayiz", "Изюм", "Raisins", ["mayiz", "изюм"]),
  P("driedapricot", "nuts", "kg", 60_000, "Turshak", "Курага", "Dried apricots", ["turshak", "курага", "dried apricot", "quruq o'rik"]),
  // ---- household
  P("detergent", "household", "kg", 35_000, "Kir yuvish kukuni", "Стиральный порошок", "Laundry detergent", ["kukun", "kir kukuni", "стиральный порошок", "порошок", "detergent"]),
  P("dishsoap", "household", "l", 15_000, "Idish yuvish vositasi", "Средство для посуды", "Dish soap", ["idish yuvish", "средство для посуды", "fairy", "dish soap"]),
  P("bucket", "household", "dona", 25_000, "Chelak", "Ведро", "Bucket", ["chelak", "ведро", "buckets"]),
  // ---- building materials
  P("cement", "building", "qop", 95_000, "Sement (50 kg)", "Цемент (50 кг)", "Cement (50 kg bag)", ["sement", "цемент"]),
  P("brick", "building", "dona", 1_200, "G'isht", "Кирпич", "Brick", ["gisht", "g'isht", "кирпич", "bricks"]),
  P("rebar", "building", "kg", 12_000, "Armatura", "Арматура", "Rebar", ["armatura", "арматура"]),
  P("plank", "building", "m", 25_000, "Yog'och taxta", "Доска", "Wooden plank", ["taxta", "yogoch", "yog'och", "доска", "доски", "planks", "timber"]),
  // ---- textiles & clothing
  P("cotton", "textiles", "m", 45_000, "Paxta mato", "Хлопковая ткань", "Cotton fabric", ["mato", "paxta mato", "хлопок", "ткань", "fabric"]),
  P("atlas", "textiles", "m", 120_000, "Atlas", "Атлас", "Atlas silk", ["atlas", "адрас", "атлас", "silk"]),
  P("carpet", "textiles", "dona", 900_000, "Gilam", "Ковёр", "Carpet", ["gilam", "ковер", "ковёр", "carpets"]),
  // ---- electronics
  P("charger", "electronics", "dona", 45_000, "Telefon zaryadlovchi", "Зарядка для телефона", "Phone charger", ["zaryadka", "zaryadlovchi", "зарядка", "зарядное", "charger"]),
  P("ledlamp", "electronics", "dona", 25_000, "LED lampa", "LED лампа", "LED bulb", ["lampa", "lampochka", "лампа", "лампочка", "led", "bulb"]),
  P("extension", "electronics", "dona", 60_000, "Uzaytirgich", "Удлинитель", "Extension cord", ["uzaytirgich", "удлинитель", "extension cord"]),
  // ---- tools & hardware
  P("hammer", "tools", "dona", 55_000, "Bolg'a", "Молоток", "Hammer", ["bolga", "bolg'a", "молоток"]),
  P("shovel", "tools", "dona", 70_000, "Belkurak", "Лопата", "Shovel", ["belkurak", "лопата", "spade"]),
  P("drill", "tools", "dona", 650_000, "Drel", "Дрель", "Electric drill", ["drel", "дрель", "perforator", "перфоратор"]),
];

const ALIAS_INDEX = new Map<string, string>();
for (const p of PRODUCTS) for (const a of p.aliases) ALIAS_INDEX.set(normalize(a), p.key);

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[’'`ʻ]/g, "").replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Resolve free text ("Pomidor", "помидоры", "500 kg tomato", "kartoshkaa") to a canonical key, or null.
 * Exact alias → alias contained in the text → fuzzy (edit distance ≤ 1 for short words, ≤ 2 for long).
 */
export function resolveProduct(input: string): string | null {
  const n = normalize(input);
  if (!n) return null;
  if (ALIAS_INDEX.has(n)) return ALIAS_INDEX.get(n)!;
  let best: { key: string; len: number } | null = null;
  for (const [alias, key] of ALIAS_INDEX) if (alias.length >= 3 && n.includes(alias) && (!best || alias.length > best.len)) best = { key, len: alias.length };
  if (best) return best.key;
  // fuzzy: typos like "kartoshkaa", "pomidr", "картошк"
  let fuzzy: { key: string; d: number } | null = null;
  for (const token of n.split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 4) continue;
    for (const [alias, key] of ALIAS_INDEX) {
      if (alias.includes(" ") || Math.abs(alias.length - token.length) > 2) continue;
      const d = levenshtein(token, alias);
      const allowed = token.length >= 7 ? 2 : 1;
      if (d <= allowed && (!fuzzy || d < fuzzy.d)) fuzzy = { key, d };
    }
  }
  return fuzzy?.key ?? null;
}

export function productDef(key: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.key === key);
}

export function productLabel(key: string): ProductDef["label"] | undefined {
  return productDef(key)?.label;
}

export function productUnit(key: string): Unit {
  return productDef(key)?.unit ?? "kg";
}
