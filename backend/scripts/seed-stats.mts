import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const per = await p.listing.groupBy({ by: ["product"], _count: { _all: true } });
const counts = per.map((x) => x._count._all).sort((a, b) => a - b);
console.log(`products with listings: ${per.length} · listings per product min/median/max: ${counts[0]} / ${counts[Math.floor(counts.length / 2)]} / ${counts[counts.length - 1]}`);
console.log(`sellers: ${await p.seller.count()} · listings: ${await p.listing.count()} · price reports: ${await p.priceHistory.count()} · reviews: ${await p.review.count()}`);
await p.$disconnect();
