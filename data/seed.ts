/**
 * Seed: fictional sellers across Tashkent bazaars + a few regional wholesalers,
 * × vegetables / fruits. Prices are UZS per kg, roughly realistic.
 *
 * Run: npm run db:seed   (from repo root)
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS, type Category } from "../backend/src/products.js";
import { photoFor } from "../backend/src/photos.js";
import { calculateCommission } from "../backend/src/commission.js";

const prisma = new PrismaClient();

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const T = "toshkent-shahri";

/**
 * How a seller reports prices — drives PriceHistory (P3 forecasting, P5 reliability):
 *   daily    every day, varied prices, last report 2h ago        → Gold
 *   regular  every 2 days, varied, last report ~26h ago          → Silver (passes the trust gate)
 *   spammer  every day but the SAME price every time, 2h ago     → Silver, never Gold (anti-farming)
 *   quiet    reported for a while, then nothing for 10 days      → Bronze/New, stale → gated out of top-3
 *   none     never reported                                       → New, gated out of top-3
 */
type Reporting = "daily" | "regular" | "spammer" | "quiet" | "none";

type SellerSeed = {
  name: string; bazaar: string; region: string; province: string; lat: number; lng: number;
  verified: boolean; rating: number; reviewCount: number; phone: string; reporting: Reporting;
  listings: [product: string, pricePerKg: number, minOrderKg: number, reportedDaysAgo: number][];
};

const sellers: SellerSeed[] = [
  // ---- Tashkent city ----
  { name: "Akbarov Farm", reporting: "daily", bazaar: "Chorsu Bazaar", region: "Shaykhantahur", province: T, lat: 41.3265, lng: 69.2352, verified: true, rating: 4.7, reviewCount: 128, phone: "+998901110001",
    listings: [["tomato", 15_500, 50, 1], ["potato", 6_200, 100, 1], ["onion", 4_800, 100, 2], ["cucumber", 9_500, 30, 1]] },
  { name: "Olmazor Sabzavot", reporting: "regular", bazaar: "Olmazor Bazaar", region: "Almazar", province: T, lat: 41.3439, lng: 69.2160, verified: true, rating: 4.4, reviewCount: 74, phone: "+998901110002",
    listings: [["tomato", 14_000, 30, 0], ["potato", 5_900, 50, 0], ["onion", 4_500, 50, 1], ["carrot", 5_200, 50, 0]] },
  { name: "Farhod aka", reporting: "regular", bazaar: "Farhod Bazaar", region: "Chilanzar", province: T, lat: 41.2740, lng: 69.1880, verified: false, rating: 4.1, reviewCount: 22, phone: "+998901110003",
    listings: [["tomato", 12_500, 20, 3], ["potato", 5_400, 50, 3]] },
  { name: "Yunusobod Meva", reporting: "daily", bazaar: "Yunusobod Bazaar", region: "Yunusabad", province: T, lat: 41.3660, lng: 69.2890, verified: true, rating: 4.5, reviewCount: 96, phone: "+998901110004",
    listings: [["tomato", 17_000, 20, 0], ["potato", 6_800, 30, 1], ["onion", 5_500, 30, 0], ["apple", 14_000, 20, 0], ["grape", 18_000, 20, 1]] },
  { name: "Qo'yliq Ulgurji", reporting: "daily", bazaar: "Qo'yliq Bazaar", region: "Bektemir", province: T, lat: 41.2530, lng: 69.3600, verified: true, rating: 4.2, reviewCount: 210, phone: "+998901110005",
    listings: [["tomato", 13_000, 200, 1], ["potato", 5_100, 500, 1], ["onion", 4_100, 500, 1], ["carrot", 4_600, 300, 1], ["apple", 11_500, 200, 1]] },
  { name: "Sergeli Dehqon", reporting: "spammer", bazaar: "Sergeli Bazaar", region: "Sergeli", province: T, lat: 41.2230, lng: 69.2230, verified: false, rating: 3.8, reviewCount: 15, phone: "+998901110006",
    listings: [["tomato", 12_000, 50, 5], ["onion", 4_300, 100, 5], ["cucumber", 8_800, 50, 5]] },
  { name: "Mirobod Fresh", reporting: "daily", bazaar: "Mirobod Bazaar", region: "Mirabad", province: T, lat: 41.2960, lng: 69.2830, verified: true, rating: 4.8, reviewCount: 61, phone: "+998901110007",
    listings: [["tomato", 18_000, 10, 0], ["potato", 6_900, 20, 0], ["onion", 5_500, 20, 0], ["cucumber", 11_000, 10, 0], ["grape", 22_000, 10, 0]] },
  { name: "Parkent Sabzavot", reporting: "quiet", bazaar: "Parkent Bazaar", region: "Yashnabad", province: T, lat: 41.3060, lng: 69.3110, verified: false, rating: 3.6, reviewCount: 9, phone: "+998901110008",
    listings: [["tomato", 38_000, 50, 8], ["potato", 5_600, 100, 8], ["onion", 4_400, 100, 8]] }, // 38 000 is a deliberate outlier (typo) for anomaly detection
  { name: "Beshyog'och Bozori", reporting: "regular", bazaar: "Beshyog'och Bazaar", region: "Yakkasaray", province: T, lat: 41.3010, lng: 69.2540, verified: false, rating: 4.0, reviewCount: 33, phone: "+998901110009",
    listings: [["tomato", 14_500, 20, 2], ["potato", 6_000, 50, 2], ["onion", 4_900, 50, 2], ["carrot", 5_400, 30, 2]] },
  { name: "Chilonzor Dehqon", reporting: "daily", bazaar: "Chilonzor Bazaar", region: "Chilanzar", province: T, lat: 41.2850, lng: 69.2030, verified: true, rating: 4.3, reviewCount: 48, phone: "+998901110010",
    listings: [["tomato", 13_800, 30, 1], ["potato", 5_700, 50, 1], ["onion", 4_600, 50, 1], ["apple", 12_500, 30, 1]] },
  { name: "Chorsu Agro MCHJ", reporting: "daily", bazaar: "Chorsu Bazaar", region: "Chorsu", province: T, lat: 41.3270, lng: 69.2340, verified: true, rating: 4.6, reviewCount: 152, phone: "+998901110011",
    listings: [["tomato", 13_200, 100, 0], ["potato", 5_300, 200, 0], ["onion", 4_200, 200, 0], ["carrot", 4_900, 100, 0], ["cucumber", 9_000, 50, 0]] },
  // ---- Tashkent region ----
  { name: "Anvar aka", reporting: "daily", bazaar: "Qibray Dehqon Bozori", region: "Qibray", province: "toshkent", lat: 41.3880, lng: 69.4650, verified: true, rating: 4.9, reviewCount: 210, phone: "+998901110012",
    listings: [["tomato", 11_800, 100, 0], ["cucumber", 8_200, 50, 0], ["apple", 10_500, 100, 0], ["grape", 15_500, 50, 0]] },
  // ---- regions ----
  { name: "Xorazm Sabzavot", reporting: "regular", bazaar: "Urganch Dehqon Bozori", region: "Urganch", province: "xorazm", lat: 41.5500, lng: 60.6333, verified: true, rating: 4.8, reviewCount: 89, phone: "+998901110013",
    listings: [["tomato", 9_500, 500, 1], ["potato", 4_200, 500, 1], ["onion", 3_300, 500, 1], ["carrot", 3_800, 500, 1]] },
  { name: "Zarafshon Bog'i", reporting: "daily", bazaar: "Siyob Bozori", region: "Samarqand", province: "samarqand", lat: 39.6542, lng: 66.9597, verified: true, rating: 4.7, reviewCount: 64, phone: "+998901110014",
    listings: [["tomato", 10_500, 200, 0], ["onion", 3_600, 300, 0], ["apple", 8_500, 200, 0], ["grape", 12_000, 100, 0]] },
  { name: "Qashqadaryo Meva", reporting: "regular", bazaar: "Qarshi Markaziy Bozor", region: "Qarshi", province: "qashqadaryo", lat: 38.8600, lng: 65.7890, verified: false, rating: 4.5, reviewCount: 41, phone: "+998901110015",
    listings: [["tomato", 10_000, 300, 2], ["potato", 4_500, 300, 2], ["grape", 11_000, 200, 2]] },
  { name: "Farg'ona Fresh", reporting: "daily", bazaar: "Farg'ona Markaziy Bozor", region: "Farg'ona", province: "fargona", lat: 40.3842, lng: 71.7843, verified: true, rating: 4.4, reviewCount: 57, phone: "+998901110016",
    listings: [["tomato", 9_800, 200, 0], ["cucumber", 7_200, 200, 0], ["onion", 3_500, 300, 0], ["apple", 9_000, 100, 0]] },
  { name: "Namangan Bog'lari", reporting: "daily", bazaar: "Namangan Markaziy Bozor", region: "Namangan", province: "namangan", lat: 40.9983, lng: 71.6726, verified: true, rating: 4.5, reviewCount: 52, phone: "+998901110018",
    listings: [["tomato", 9_900, 200, 0], ["apple", 8_800, 100, 0], ["grape", 11_500, 100, 0]] },
  { name: "Buxoro Sabzavot", reporting: "regular", bazaar: "Buxoro Markaziy Bozor", region: "Buxoro", province: "buxoro", lat: 39.7747, lng: 64.4286, verified: false, rating: 4.2, reviewCount: 31, phone: "+998901110019",
    listings: [["tomato", 10_200, 300, 1], ["onion", 3_400, 300, 1], ["carrot", 3_700, 300, 1]] },
  { name: "Jizzax Dehqon", reporting: "daily", bazaar: "Jizzax Dehqon Bozori", region: "Jizzax", province: "jizzax", lat: 40.1158, lng: 67.8422, verified: true, rating: 4.4, reviewCount: 38, phone: "+998901110020",
    listings: [["potato", 4_400, 300, 0], ["onion", 3_500, 300, 0], ["tomato", 10_800, 200, 0]] },
  { name: "Navoiy Meva", reporting: "regular", bazaar: "Navoiy Markaziy Bozor", region: "Navoiy", province: "navoiy", lat: 40.0844, lng: 65.3792, verified: false, rating: 4.1, reviewCount: 19, phone: "+998901110021",
    listings: [["apple", 9_200, 100, 1], ["grape", 12_500, 100, 1]] },
  { name: "Andijon Dehqon", reporting: "none", bazaar: "Andijon Eski Shahar Bozori", region: "Andijon", province: "andijon", lat: 40.7821, lng: 72.3442, verified: false, rating: 4.3, reviewCount: 28, phone: "+998901110017",
    listings: [["tomato", 9_600, 300, 1], ["potato", 4_300, 500, 1], ["carrot", 3_900, 300, 1]] },
];

// ---- price history generation (P3) ----
function prng(seedStr: string) {
  let seed = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const HISTORY_DAYS = 45;
/** Deliberate 45-day trends per product so the forecast has something real to detect. */
const TREND: Record<string, number> = { tomato: 0.15, onion: -0.08, potato: 0.03, cucumber: -0.12, carrot: 0.0, apple: 0.05, grape: 0.10 };
for (const p of PRODUCTS) if (!(p.key in TREND)) { const r = prng("trend:" + p.key); TREND[p.key] = Math.round((r() * 0.27 - 0.12) * 100) / 100; } // −12% … +15%
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
/** Price on day index i (0 = HISTORY_DAYS ago … HISTORY_DAYS = today) following the product trend + noise. */
function priceOn(i: number, current: number, product: string, rnd: () => number, noisy: boolean) {
  const trend = TREND[product] ?? 0;
  const start = current / (1 + trend);
  const base = start + (current - start) * (i / HISTORY_DAYS);
  const noise = noisy ? 1 + (rnd() - 0.5) * 0.06 : 1;
  return i === HISTORY_DAYS ? current : Math.round((base * noise) / 50) * 50;
}
/** Which day indexes a seller reports on, and how long ago their last report was (hours). */
function schedule(r: Reporting): { days: number[]; lastAgoH: number } {
  const all = Array.from({ length: HISTORY_DAYS + 1 }, (_, i) => i);
  switch (r) {
    case "daily": return { days: all, lastAgoH: 2 };
    case "spammer": return { days: all, lastAgoH: 2 };
    case "regular": return { days: all.filter((i) => i % 2 === HISTORY_DAYS % 2), lastAgoH: 26 };
    case "quiet": return { days: all.filter((i) => i <= HISTORY_DAYS - 10 && i % 2 === 0), lastAgoH: 10 * 24 };
    case "none": return { days: [], lastAgoH: 24 };
  }
}

// ---------------- generated sellers: ~50 per category so every product has ~50 listings ----------------
const SELLERS_PER_CATEGORY = 75; // ~70–95 listings per product
const PROVINCES: { key: string; city: string; lat: number; lng: number; weight: number; bazaars: string[] }[] = [
  { key: "toshkent-shahri", city: "Toshkent", lat: 41.3111, lng: 69.2797, weight: 10, bazaars: ["Chorsu Bazaar", "Olmazor Bazaar", "Farhod Bazaar", "Yunusobod Bazaar", "Qo'yliq Bazaar", "Sergeli Bazaar", "Mirobod Bazaar", "Parkent Bazaar", "Beshyog'och Bazaar", "Chilonzor Bazaar", "Oloy Bazaar", "Malika Bozori", "Abu Saxiy Bozori", "Bek Baraka Bozori", "O'rikzor Bozori", "Yangiobod Bozori", "Qorasuv Bozori", "Ippodrom Bozori"] },
  { key: "toshkent", city: "Qibray", lat: 41.39, lng: 69.47, weight: 2, bazaars: ["Qibray Dehqon Bozori", "Chirchiq Markaziy Bozor", "Angren Bozori"] },
  { key: "samarqand", city: "Samarqand", lat: 39.6542, lng: 66.9597, weight: 2, bazaars: ["Siyob Bozori", "Samarqand Markaziy Bozor"] },
  { key: "fargona", city: "Farg'ona", lat: 40.3842, lng: 71.7843, weight: 2, bazaars: ["Farg'ona Markaziy Bozor", "Qo'qon Bozori", "Marg'ilon Bozori"] },
  { key: "andijon", city: "Andijon", lat: 40.7821, lng: 72.3442, weight: 1, bazaars: ["Andijon Eski Shahar Bozori"] },
  { key: "namangan", city: "Namangan", lat: 40.9983, lng: 71.6726, weight: 1, bazaars: ["Namangan Markaziy Bozor"] },
  { key: "buxoro", city: "Buxoro", lat: 39.7747, lng: 64.4286, weight: 1, bazaars: ["Buxoro Markaziy Bozor"] },
  { key: "xorazm", city: "Urganch", lat: 41.55, lng: 60.6333, weight: 1, bazaars: ["Urganch Dehqon Bozori"] },
  { key: "qashqadaryo", city: "Qarshi", lat: 38.86, lng: 65.789, weight: 1, bazaars: ["Qarshi Markaziy Bozor"] },
  { key: "navoiy", city: "Navoiy", lat: 40.0844, lng: 65.3792, weight: 1, bazaars: ["Navoiy Markaziy Bozor"] },
  { key: "jizzax", city: "Jizzax", lat: 40.1158, lng: 67.8422, weight: 1, bazaars: ["Jizzax Dehqon Bozori"] },
  { key: "surxondaryo", city: "Termiz", lat: 37.2242, lng: 67.2783, weight: 1, bazaars: ["Termiz Markaziy Bozor"] },
];
const FIRST = ["Akmal", "Nodira", "Bobur", "Dilnoza", "Jasur", "Madina", "Sardor", "Sevara", "Otabek", "Gulnora", "Rustam", "Zulfiya", "Sherzod", "Malika", "Farrux", "Nigora", "Ulug'bek", "Kamola", "Aziz", "Feruza", "Doston", "Shahnoza", "Bekzod", "Munisa", "Javlon", "Dildora"];
const BRAND_A = ["Baraka", "Farovon", "Zamin", "Omad", "Iqbol", "Ziyo", "Nur", "Umid", "Bahor", "Navro'z", "Chinor", "Ipak", "Oltin", "Kumush", "Yulduz", "Diyor", "Sharq", "Obod", "Sahovat", "Rizq", "Barakat", "Istiqbol", "Kamalak", "Mehr", "Sarbon"];
const BRAND_B: Record<Category, string[]> = {
  vegetables: ["Sabzavot", "Dehqon", "Agro"], fruits: ["Meva", "Bog'i", "Fresh"], meat: ["Go'sht", "Qassob", "Ferma"], dairy: ["Sut", "Milk", "Ferma"],
  grains: ["Don", "Savdo", "Ulgurji"], spices: ["Ziravor", "Savdo", "Trade"], nuts: ["Meva", "Savdo", "Quruq Meva"], household: ["Market", "Savdo", "Home"],
  building: ["Qurilish", "Stroy", "Beton"], textiles: ["Mato", "Tekstil", "Atlas"], electronics: ["Elektro", "Tech", "Market"], tools: ["Asbob", "Instrument", "Master"],
};
type GenSeller = Omit<SellerSeed, "listings"> & { listings: SellerSeed["listings"] };
function generateSellers(existingNames: Set<string>): GenSeller[] {
  const out: GenSeller[] = [];
  const provPool = PROVINCES.flatMap((p) => Array(p.weight).fill(p) as typeof PROVINCES);
  let phone = 20;
  for (const cat of CATEGORIES) {
    const products = PRODUCTS.filter((p) => p.category === cat.key);
    const rnd = prng("sellers:" + cat.key);
    for (let i = 0; i < SELLERS_PER_CATEGORY; i++) {
      const prov = provPool[Math.floor(rnd() * provPool.length)];
      let name = rnd() < 0.45
        ? `${FIRST[Math.floor(rnd() * FIRST.length)]} ${rnd() < 0.5 ? "aka" : "opa"}`
        : `${BRAND_A[Math.floor(rnd() * BRAND_A.length)]} ${BRAND_B[cat.key][Math.floor(rnd() * BRAND_B[cat.key].length)]}${rnd() < 0.3 ? " MCHJ" : ""}`;
      let n = 2; const base = name; while (existingNames.has(name)) name = `${base} ${n++}`;
      existingNames.add(name);
      const r = rnd();
      const reporting: Reporting = r < 0.6 ? "daily" : r < 0.9 ? "regular" : r < 0.95 ? "quiet" : "none";
      const regional = prov.key !== "toshkent-shahri";
      // Seller archetype — makes "cheap", "quality" and "near" genuinely pick different sellers:
      //   bargain   : ~15–30 % under market, rating 3.0–3.9, rarely verified
      //   regular   : around market, rating 3.6–4.5
      //   premium   : ~15–40 % over market, rating 4.4–5.0, usually verified
      const a = rnd();
      const archetype = a < 0.25 ? "bargain" : a < 0.75 ? "regular" : "premium";
      const priceBias = archetype === "bargain" ? 0.7 + rnd() * 0.15 : archetype === "premium" ? 1.15 + rnd() * 0.25 : 0.9 + rnd() * 0.2;
      const rating = Math.round((archetype === "bargain" ? 3.0 + rnd() * 0.9 : archetype === "premium" ? 4.4 + rnd() * 0.6 : 3.6 + rnd() * 0.9) * 10) / 10;
      const verified = rnd() < (archetype === "premium" ? 0.85 : archetype === "bargain" ? 0.25 : 0.55);
      const listings: SellerSeed["listings"] = [];
      for (const p of products) {
        if (rnd() > 0.95) continue; // a few sellers skip a product
        const spread = priceBias * (0.94 + rnd() * 0.12); // archetype bias ± 6 % per product
        const regionalDiscount = regional ? 0.82 : 1;
        const price = Math.max(50, Math.round((p.basePrice * spread * regionalDiscount) / (p.basePrice >= 10_000 ? 500 : 50)) * (p.basePrice >= 10_000 ? 500 : 50));
        const minOrder = p.unit === "kg" || p.unit === "l" ? [10, 20, 50, 100, 200][Math.floor(rnd() * 5)] : p.unit === "dona" ? [1, 5, 10, 50][Math.floor(rnd() * 4)] : p.unit === "qop" ? [5, 10, 20][Math.floor(rnd() * 3)] : [10, 50, 100][Math.floor(rnd() * 3)];
        listings.push([p.key, price, minOrder, 0]);
      }
      out.push({
        name, bazaar: prov.bazaars[Math.floor(rnd() * prov.bazaars.length)], region: prov.key === "toshkent-shahri" ? ["Chilanzar", "Yunusabad", "Mirabad", "Yakkasaray", "Shaykhantahur", "Almazar", "Sergeli", "Bektemir", "Uchtepa", "Yashnabad"][Math.floor(rnd() * 10)] : prov.city,
        // Tashkent sellers spread across the whole city (≈ ±17 km) so distance really separates them
        province: prov.key, lat: prov.lat + (rnd() - 0.5) * (regional ? 0.08 : 0.3), lng: prov.lng + (rnd() - 0.5) * (regional ? 0.08 : 0.4),
        verified, rating, reviewCount: Math.floor(archetype === "premium" ? 60 + rnd() * 400 : 5 + rnd() * 160), phone: `+99890${String(1110000 + phone++).padStart(7, "0")}`,
        reporting, listings,
      });
    }
  }
  return out;
}

async function main() {
  await prisma.deal.deleteMany();
  await prisma.contactUnlock.deleteMany();
  await prisma.buyerInteraction.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.review.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.seller.deleteMany();

  let listingCount = 0;
  let historyCount = 0;
  let firstSellerId = 0;
  const listingIds = new Map<string, number>(); // "Seller name:product" → listing id (for interactions)
  const allSeeds: SellerSeed[] = [...sellers, ...generateSellers(new Set(sellers.map((x) => x.name)))];
  let historyBatch: { sellerId: number; product: string; region: string; price: number; reportedAt: Date }[] = [];
  const flushHistory = async () => { if (historyBatch.length) { await prisma.priceHistory.createMany({ data: historyBatch }); historyCount += historyBatch.length; historyBatch = []; } };
  for (const { listings, reporting, ...data } of allSeeds) {
    const seller = await prisma.seller.create({ data });
    firstSellerId ||= seller.id;
    const { days, lastAgoH } = schedule(reporting);
    const lastDay = days.length ? Math.max(...days) : HISTORY_DAYS;
    const listingRows = [];
    for (const [product, pricePerKg, minOrderKg, ago] of listings) {
      const rnd = prng(`${seller.name}:${product}`);
      const rows = days.map((i) => ({
        sellerId: seller.id, product, region: data.province,
        price: reporting === "spammer" ? pricePerKg : priceOn(i, pricePerKg, product, rnd, true),
        // the seller's LAST report is `lastAgoH` hours ago; earlier ones are whole days before it
        reportedAt: hoursAgo(lastAgoH + (lastDay - i) * 24),
      }));
      // the spammer files the same price ten times a day — pure repetition, no information
      if (reporting === "spammer") for (const r of [...rows]) for (let k = 1; k < 10; k++) rows.push({ ...r, reportedAt: new Date(r.reportedAt.getTime() - k * 3_600_000) });
      historyBatch.push(...rows);
      if (historyBatch.length >= 2000) await flushHistory();
      const last = rows.length ? new Date(Math.max(...rows.map((r) => r.reportedAt.getTime()))) : daysAgo(ago);
      // a real photo of the product (Wikimedia Commons); sellers rotate through 3 pictures — real uploads later
      listingRows.push({ sellerId: seller.id, product, pricePerKg, minOrderKg, reportedAt: last, photoUrl: photoFor(product, seller.id) });
    }
    await prisma.listing.createMany({ data: listingRows });
    const created = await prisma.listing.findMany({ where: { sellerId: seller.id }, select: { id: true, product: true } });
    for (const l of created) listingIds.set(`${seller.name}:${l.product}`, l.id);
    listingCount += listingRows.length;
  }
  await flushHistory();

  // ---- fake buyers + reviews so every profile has a few (deterministic, not random) ----
  const buyerSeeds = [
    { telegramUserId: "demo-buyer", name: "Sardor Rahimov" },
    { telegramUserId: "demo-buyer-2", name: "Dilnoza Karimova" },
    { telegramUserId: "demo-buyer-3", name: "Bahor Restaurant" },
    { telegramUserId: "demo-buyer-4", name: "Jasur Tashkentov" },
    { telegramUserId: "demo-buyer-5", name: "Madina Yusupova" },
    { telegramUserId: "demo-buyer-6", name: "Oqtepa Lavash" },
    { telegramUserId: "demo-buyer-7", name: "Bobur Nazarov" },
    { telegramUserId: "demo-buyer-8", name: "Sevara Alimova" },
  ];
  const buyers = [];
  for (const b of buyerSeeds) buyers.push(await prisma.buyer.create({ data: { ...b, tier: "free" } }));

  const comments: [rating: number, comment: string][] = [
    [5, "Fresh, delivered on time. Will order again."],
    [5, "Juda sifatli mahsulot, narxi ham mos. Rahmat!"],
    [4, "Good quality, slightly higher price than others nearby."],
    [5, "Pomidorlar yangi va shirin edi. Restoranimiz uchun doimiy olamiz."],
    [4, "Товар хороший, но доставка задержалась на час."],
    [5, "Ulgurji narxi juda yaxshi, 500 kg oldik — hammasi bir xil sifatda."],
    [3, "Quality was okay, some potatoes were small."],
    [5, "Отличный продавец, всегда отвечает быстро."],
    [4, "Narxi kelishildi, mahsulot yaxshi. Tavsiya qilaman."],
    [5, "Best onions at Chorsu, honestly."],
    [4, "Sabzi yaxshi, lekin qadoqlash zaif edi."],
    [5, "Всё свежее, цена ниже рыночной. Берём каждую неделю."],
  ];

  let reviewCount = 0;
  const allSellers = await prisma.seller.findMany({ orderBy: { id: "asc" } });
  const reviewRows = [];
  for (const [i, seller] of allSellers.entries()) {
    // 2–4 reviews per seller, picked deterministically so demos are repeatable
    const n = 2 + ((i * 7) % 3);
    for (let k = 0; k < n; k++) {
      const [rating, comment] = comments[(i * 5 + k * 3) % comments.length];
      const buyer = buyers[(i + k * 2) % buyers.length];
      reviewRows.push({ sellerId: seller.id, buyerId: buyer.id, rating, comment, createdAt: daysAgo(3 + ((i * 11 + k * 9) % 40)) });
    }
  }
  for (let i = 0; i < reviewRows.length; i += 1000) await prisma.review.createMany({ data: reviewRows.slice(i, i + 1000) });
  reviewCount = reviewRows.length;

  // ---- buyer interaction history (P4): two opposite habits ----
  const cheap = await prisma.buyer.create({ data: { telegramUserId: "demo-cheap", name: "Arzon Xaridor", tier: "free" } });
  const quality = await prisma.buyer.create({ data: { telegramUserId: "demo-quality", name: "Sifat Xaridor", tier: "free" } });
  const contacts: [buyerId: number, key: string][] = [
    // always the cheapest option in Tashkent, whatever the rating
    [cheap.id, "Sergeli Dehqon:tomato"], [cheap.id, "Qo'yliq Ulgurji:potato"], [cheap.id, "Qo'yliq Ulgurji:onion"], [cheap.id, "Qo'yliq Ulgurji:carrot"], [cheap.id, "Farhod aka:tomato"],
    // always the highest-rated option, whatever the price
    [quality.id, "Mirobod Fresh:tomato"], [quality.id, "Mirobod Fresh:potato"], [quality.id, "Mirobod Fresh:onion"], [quality.id, "Akbarov Farm:tomato"], [quality.id, "Mirobod Fresh:cucumber"],
  ];
  let interactionCount = 0;
  for (const [buyerId, key] of contacts) {
    const listingId = listingIds.get(key);
    if (!listingId) throw new Error(`seed: no listing for ${key}`);
    await prisma.buyerInteraction.create({ data: { buyerId, listingId, action: "viewed", createdAt: daysAgo(3 + interactionCount) } });
    await prisma.buyerInteraction.create({ data: { buyerId, listingId, action: "contacted", createdAt: daysAgo(2 + interactionCount) } });
    interactionCount += 2;
  }

  // ---- sales history: accepted (and a few declined) deals over the last 30 days for the named sellers,
  //      so a seller dashboard has something to show. Deterministic.
  const named = await prisma.seller.findMany({ where: { name: { in: sellers.map((x) => x.name) } }, include: { listings: true } });
  const allBuyers = await prisma.buyer.findMany();
  const dealRows = [];
  for (const [si, sel] of named.entries()) {
    const rnd = prng("deals:" + sel.name);
    const n = 18 + Math.floor(rnd() * 30); // 18–47 deals per named seller in 30 days
    for (let k = 0; k < n; k++) {
      const l = sel.listings[Math.floor(rnd() * sel.listings.length)];
      if (!l) continue;
      // front-loaded so every window (12h / 24h / 7d / 30d) has something: 15 % in the last 12h, 15 % in 12–24h, 30 % in the last week
      const r = rnd();
      const hoursAgoV = r < 0.15 ? rnd() * 12 : r < 0.3 ? 12 + rnd() * 12 : r < 0.6 ? 24 + rnd() * 6 * 24 : 7 * 24 + rnd() * 23 * 24;
      const qty = l.minOrderKg * (1 + Math.floor(rnd() * 6));
      const agreed = Math.round((l.pricePerKg * (0.9 + rnd() * 0.16)) / 50) * 50; // −10 % … +6 % vs list
      const accepted = rnd() < 0.82;
      const total = agreed * qty;
      const at = hoursAgo(hoursAgoV);
      dealRows.push({
        listingId: l.id, buyerId: allBuyers[(si + k) % allBuyers.length].id, sellerId: sel.id, quantity: qty,
        status: accepted ? "accepted" : "declined", initialOffer: Math.round(agreed * 0.97 / 50) * 50, counterOffer: rnd() < 0.5 ? agreed : null,
        agreedPrice: accepted ? agreed : null, totalValue: accepted ? total : null, commissionAmt: accepted ? calculateCommission(total).totalCommission : null,
        createdAt: new Date(at.getTime() - 3_600_000), updatedAt: at,
      });
    }
  }
  for (let i = 0; i < dealRows.length; i += 500) await prisma.deal.createMany({ data: dealRows.slice(i, i + 500) });

  console.log(`Seeded ${allSeeds.length} sellers, ${listingCount} listings, ${historyCount} price reports, ${buyers.length + 2} buyers, ${reviewCount} reviews, ${interactionCount} interactions, ${dealRows.length} past deals.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
