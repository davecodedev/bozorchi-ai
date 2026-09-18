/**
 * Seed: fictional sellers across Tashkent bazaars + a few regional wholesalers,
 * × vegetables / fruits. Prices are UZS per kg, roughly realistic.
 *
 * Run: npm run db:seed   (from repo root)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const T = "toshkent-shahri";

type SellerSeed = {
  name: string; bazaar: string; region: string; province: string; lat: number; lng: number;
  verified: boolean; rating: number; reviewCount: number; phone: string;
  listings: [product: string, pricePerKg: number, minOrderKg: number, reportedDaysAgo: number][];
};

const sellers: SellerSeed[] = [
  // ---- Tashkent city ----
  { name: "Akbarov Farm", bazaar: "Chorsu Bazaar", region: "Shaykhantahur", province: T, lat: 41.3265, lng: 69.2352, verified: true, rating: 4.7, reviewCount: 128, phone: "+998901110001",
    listings: [["tomato", 15_500, 50, 1], ["potato", 6_200, 100, 1], ["onion", 4_800, 100, 2], ["cucumber", 9_500, 30, 1]] },
  { name: "Olmazor Sabzavot", bazaar: "Olmazor Bazaar", region: "Almazar", province: T, lat: 41.3439, lng: 69.2160, verified: true, rating: 4.4, reviewCount: 74, phone: "+998901110002",
    listings: [["tomato", 14_000, 30, 0], ["potato", 5_900, 50, 0], ["onion", 4_500, 50, 1], ["carrot", 5_200, 50, 0]] },
  { name: "Farhod aka", bazaar: "Farhod Bazaar", region: "Chilanzar", province: T, lat: 41.2740, lng: 69.1880, verified: false, rating: 4.1, reviewCount: 22, phone: "+998901110003",
    listings: [["tomato", 12_500, 20, 3], ["potato", 5_400, 50, 3]] },
  { name: "Yunusobod Meva", bazaar: "Yunusobod Bazaar", region: "Yunusabad", province: T, lat: 41.3660, lng: 69.2890, verified: true, rating: 4.5, reviewCount: 96, phone: "+998901110004",
    listings: [["tomato", 17_000, 20, 0], ["potato", 6_800, 30, 1], ["onion", 5_500, 30, 0], ["apple", 14_000, 20, 0], ["grape", 18_000, 20, 1]] },
  { name: "Qo'yliq Ulgurji", bazaar: "Qo'yliq Bazaar", region: "Bektemir", province: T, lat: 41.2530, lng: 69.3600, verified: true, rating: 4.2, reviewCount: 210, phone: "+998901110005",
    listings: [["tomato", 13_000, 200, 1], ["potato", 5_100, 500, 1], ["onion", 4_100, 500, 1], ["carrot", 4_600, 300, 1], ["apple", 11_500, 200, 1]] },
  { name: "Sergeli Dehqon", bazaar: "Sergeli Bazaar", region: "Sergeli", province: T, lat: 41.2230, lng: 69.2230, verified: false, rating: 3.8, reviewCount: 15, phone: "+998901110006",
    listings: [["tomato", 12_000, 50, 5], ["onion", 4_300, 100, 5], ["cucumber", 8_800, 50, 5]] },
  { name: "Mirobod Fresh", bazaar: "Mirobod Bazaar", region: "Mirabad", province: T, lat: 41.2960, lng: 69.2830, verified: true, rating: 4.8, reviewCount: 61, phone: "+998901110007",
    listings: [["tomato", 19_000, 10, 0], ["potato", 7_500, 20, 0], ["onion", 6_200, 20, 0], ["cucumber", 11_000, 10, 0], ["grape", 22_000, 10, 0]] },
  { name: "Parkent Sabzavot", bazaar: "Parkent Bazaar", region: "Yashnabad", province: T, lat: 41.3060, lng: 69.3110, verified: false, rating: 3.6, reviewCount: 9, phone: "+998901110008",
    listings: [["tomato", 13_500, 50, 8], ["potato", 5_600, 100, 8], ["onion", 4_400, 100, 8]] },
  { name: "Beshyog'och Bozori", bazaar: "Beshyog'och Bazaar", region: "Yakkasaray", province: T, lat: 41.3010, lng: 69.2540, verified: false, rating: 4.0, reviewCount: 33, phone: "+998901110009",
    listings: [["tomato", 14_500, 20, 2], ["potato", 6_000, 50, 2], ["onion", 4_900, 50, 2], ["carrot", 5_400, 30, 2]] },
  { name: "Chilonzor Dehqon", bazaar: "Chilonzor Bazaar", region: "Chilanzar", province: T, lat: 41.2850, lng: 69.2030, verified: true, rating: 4.3, reviewCount: 48, phone: "+998901110010",
    listings: [["tomato", 13_800, 30, 1], ["potato", 5_700, 50, 1], ["onion", 4_600, 50, 1], ["apple", 12_500, 30, 1]] },
  { name: "Chorsu Agro MCHJ", bazaar: "Chorsu Bazaar", region: "Chorsu", province: T, lat: 41.3270, lng: 69.2340, verified: true, rating: 4.6, reviewCount: 152, phone: "+998901110011",
    listings: [["tomato", 13_200, 100, 0], ["potato", 5_300, 200, 0], ["onion", 4_200, 200, 0], ["carrot", 4_900, 100, 0], ["cucumber", 9_000, 50, 0]] },
  // ---- Tashkent region ----
  { name: "Anvar aka", bazaar: "Qibray Dehqon Bozori", region: "Qibray", province: "toshkent", lat: 41.3880, lng: 69.4650, verified: true, rating: 4.9, reviewCount: 210, phone: "+998901110012",
    listings: [["tomato", 11_800, 100, 0], ["cucumber", 8_200, 50, 0], ["apple", 10_500, 100, 0], ["grape", 15_500, 50, 0]] },
  // ---- regions ----
  { name: "Xorazm Sabzavot", bazaar: "Urganch Dehqon Bozori", region: "Urganch", province: "xorazm", lat: 41.5500, lng: 60.6333, verified: true, rating: 4.8, reviewCount: 89, phone: "+998901110013",
    listings: [["tomato", 9_500, 500, 1], ["potato", 4_200, 500, 1], ["onion", 3_300, 500, 1], ["carrot", 3_800, 500, 1]] },
  { name: "Zarafshon Bog'i", bazaar: "Siyob Bozori", region: "Samarqand", province: "samarqand", lat: 39.6542, lng: 66.9597, verified: true, rating: 4.7, reviewCount: 64, phone: "+998901110014",
    listings: [["tomato", 10_500, 200, 0], ["onion", 3_600, 300, 0], ["apple", 8_500, 200, 0], ["grape", 12_000, 100, 0]] },
  { name: "Qashqadaryo Meva", bazaar: "Qarshi Markaziy Bozor", region: "Qarshi", province: "qashqadaryo", lat: 38.8600, lng: 65.7890, verified: false, rating: 4.5, reviewCount: 41, phone: "+998901110015",
    listings: [["tomato", 10_000, 300, 2], ["potato", 4_500, 300, 2], ["grape", 11_000, 200, 2]] },
  { name: "Farg'ona Fresh", bazaar: "Farg'ona Markaziy Bozor", region: "Farg'ona", province: "fargona", lat: 40.3842, lng: 71.7843, verified: true, rating: 4.4, reviewCount: 57, phone: "+998901110016",
    listings: [["tomato", 9_800, 200, 0], ["cucumber", 7_200, 200, 0], ["onion", 3_500, 300, 0], ["apple", 9_000, 100, 0]] },
  { name: "Andijon Dehqon", bazaar: "Andijon Eski Shahar Bozori", region: "Andijon", province: "andijon", lat: 40.7821, lng: 72.3442, verified: false, rating: 4.3, reviewCount: 28, phone: "+998901110017",
    listings: [["tomato", 9_600, 300, 1], ["potato", 4_300, 500, 1], ["carrot", 3_900, 300, 1]] },
];

async function main() {
  await prisma.review.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.seller.deleteMany();

  let listingCount = 0;
  let firstSellerId = 0;
  for (const { listings, ...data } of sellers) {
    const seller = await prisma.seller.create({ data });
    firstSellerId ||= seller.id;
    for (const [product, pricePerKg, minOrderKg, ago] of listings) {
      await prisma.listing.create({
        data: { sellerId: seller.id, product, pricePerKg, minOrderKg, reportedAt: daysAgo(ago) },
      });
      listingCount++;
    }
  }

  const buyer = await prisma.buyer.create({
    data: { telegramUserId: "demo-buyer", name: "Sardor Rahimov", tier: "standard" },
  });
  await prisma.review.create({
    data: { sellerId: firstSellerId, buyerId: buyer.id, rating: 5, comment: "Fresh, delivered on time." },
  });

  console.log(`Seeded ${sellers.length} sellers, ${listingCount} listings, 1 buyer, 1 review.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
