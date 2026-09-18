/**
 * Pull a Tashkent district out of free text so "pomidor Chilonzor" → region "Chilanzar".
 * Keys must match REGION_CENTERS in backend/src/geo.ts.
 */
const REGION_ALIASES: Record<string, string[]> = {
  Chilanzar: ["chilanzar", "chilonzor", "чиланзар", "чилонзор"],
  Yunusabad: ["yunusabad", "yunusobod", "юнусабад", "юнусобод"],
  Mirabad: ["mirabad", "mirobod", "мирабад", "миробод"],
  Yakkasaray: ["yakkasaray", "yakkasaroy", "яккасарай", "яккасарой"],
  Shaykhantahur: ["shaykhantahur", "shayxontohur", "шайхантахур", "шайхонтохур", "chorsu", "чорсу"],
  Almazar: ["almazar", "olmazor", "алмазар", "олмазор"],
  Sergeli: ["sergeli", "сергели"],
  Bektemir: ["bektemir", "бектемир", "quyliq", "qo'yliq", "куйлюк"],
  Uchtepa: ["uchtepa", "учтепа"],
  Yashnabad: ["yashnabad", "yashnobod", "яшнабад", "яшнобод"],
  "Mirzo-Ulugbek": ["mirzo-ulugbek", "mirzo ulugbek", "mirzo ulug'bek", "мирзо-улугбек", "мирзо улугбек"],
};

export function extractRegion(text: string): string | undefined {
  const n = text.toLowerCase().replace(/[’'`ʻ]/g, "'");
  for (const [region, aliases] of Object.entries(REGION_ALIASES)) {
    if (aliases.some((a) => n.includes(a))) return region;
  }
  return undefined;
}
