/**
 * Seed: ~10 fictional sellers across Tashkent bazaars × 3 products
 * (tomato, potato, onion). Prices are UZS per kg, roughly realistic.
 *
 * Run: npm run db:seed   (from repo root)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

const sellers = [
  { name: "Akbarov Farm",        bazaar: "Chorsu Bazaar",      region: "Shaykhantahur", lat: 41.3265, lng: 69.2352, verified: true,  rating: 4.7, reviewCount: 128, phone: "+998901110001" },
  { name: "Olmazor Sabzavot",    bazaar: "Olmazor Bazaar",     region: "Almazar",       lat: 41.3439, lng: 69.2160, verified: true,  rating: 4.4, reviewCount: 74,  phone: "+998901110002" },
  { name: "Farhod aka",          bazaar: "Farhod Bazaar",      region: "Chilanzar",     lat: 41.2740, lng: 69.1880, verified: false, rating: 4.1, reviewCount: 22,  phone: "+998901110003" },
  { name: "Yunusobod Meva",      bazaar: "Yunusobod Bazaar",   region: "Yunusabad",     lat: 41.3660, lng: 69.2890, verified: true,  rating: 4.5, reviewCount: 96,  phone: "+998901110004" },
  { name: "Qo'yliq Ulgurji",     bazaar: "Qo'yliq Bazaar",     region: "Bektemir",      lat: 41.2530, lng: 69.3600, verified: true,  rating: 4.2, reviewCount: 210, phone: "+998901110005" },
  { name: "Sergeli Dehqon",      bazaar: "Sergeli Bazaar",     region: "Sergeli",       lat: 41.2230, lng: 69.2230, verified: false, rating: 3.8, reviewCount: 15,  phone: "+998901110006" },
  { name: "Mirobod Fresh",       bazaar: "Mirobod Bazaar",     region: "Mirabad",       lat: 41.2960, lng: 69.2830, verified: true,  rating: 4.8, reviewCount: 61,  phone: "+998901110007" },
  { name: "Parkent Sabzavot",    bazaar: "Parkent Bazaar",     region: "Yashnabad",     lat: 41.3060, lng: 69.3110, verified: false, rating: 3.6, reviewCount: 9,   phone: "+998901110008" },
  { name: "Beshyog'och Bozori",  bazaar: "Beshyog'och Bazaar", region: "Yakkasaray",    lat: 41.3010, lng: 69.2540, verified: false, rating: 4.0, reviewCount: 33,  phone: "+998901110009" },
  { name: "Chilonzor Dehqon",    bazaar: "Chilonzor Bazaar",   region: "Chilanzar",     lat: 41.2850, lng: 69.2030, verified: true,  rating: 4.3, reviewCount: 48,  phone: "+998901110010" },
];

// [product, pricePerKg (UZS), minOrderKg, reportedDaysAgo] — indexed by seller position above.
const listings: Record<number, [string, number, number, number][]> = {
  0: [["tomato", 15_500, 50, 1], ["potato", 6_200, 100, 1], ["onion", 4_800, 100, 2]],
  1: [["tomato", 14_000, 30, 0], ["potato", 5_900, 50, 0], ["onion", 4_500, 50, 1]],
  2: [["tomato", 12_500, 20, 3], ["potato", 5_400, 50, 3]],                          // no onion
  3: [["tomato", 17_000, 20, 0], ["potato", 6_800, 30, 1], ["onion", 5_500, 30, 0]],
  4: [["tomato", 13_000, 200, 1], ["potato", 5_100, 500, 1], ["onion", 4_100, 500, 1]], // wholesale: cheap, big minimums
  5: [["tomato", 12_000, 50, 5], ["onion", 4_300, 100, 5]],                          // no potato
  6: [["tomato", 19_000, 10, 0], ["potato", 7_500, 20, 0], ["onion", 6_200, 20, 0]],  // premium
  7: [["tomato", 13_500, 50, 8], ["potato", 5_600, 100, 8], ["onion", 4_400, 100, 8]],
  8: [["tomato", 14_500, 20, 2], ["potato", 6_000, 50, 2], ["onion", 4_900, 50, 2]],
  9: [["tomato", 13_800, 30, 1], ["potato", 5_700, 50, 1], ["onion", 4_600, 50, 1]],
};

async function main() {
  await prisma.review.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.seller.deleteMany();

  let listingCount = 0;
  for (let i = 0; i < sellers.length; i++) {
    const seller = await prisma.seller.create({ data: sellers[i] });
    for (const [product, pricePerKg, minOrderKg, ago] of listings[i] ?? []) {
      await prisma.listing.create({
        data: { sellerId: seller.id, product, pricePerKg, minOrderKg, reportedAt: daysAgo(ago) },
      });
      listingCount++;
    }
  }

  const buyer = await prisma.buyer.create({
    data: { telegramUserId: "demo-buyer", name: "Demo Buyer", tier: "standard" },
  });
  await prisma.review.create({
    data: { sellerId: 1, buyerId: buyer.id, rating: 5, comment: "Fresh, delivered on time." },
  });

  console.log(`Seeded ${sellers.length} sellers, ${listingCount} listings, 1 buyer, 1 review.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
