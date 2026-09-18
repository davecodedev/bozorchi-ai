/** Haversine distance in km between two lat/lng points. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Uzbekistan's regions (viloyatlar) + Tashkent city. Keys are stored on Seller.province. */
export const PROVINCES: { key: string; label: { uz: string; ru: string; en: string }; lat: number; lng: number }[] = [
  { key: "toshkent-shahri", label: { uz: "Toshkent shahri", ru: "г. Ташкент", en: "Tashkent city" }, lat: 41.3111, lng: 69.2797 },
  { key: "toshkent", label: { uz: "Toshkent", ru: "Ташкентская обл.", en: "Tashkent region" }, lat: 41.39, lng: 69.47 },
  { key: "andijon", label: { uz: "Andijon", ru: "Андижан", en: "Andijan" }, lat: 40.7821, lng: 72.3442 },
  { key: "fargona", label: { uz: "Farg'ona", ru: "Фергана", en: "Fergana" }, lat: 40.3842, lng: 71.7843 },
  { key: "namangan", label: { uz: "Namangan", ru: "Наманган", en: "Namangan" }, lat: 40.9983, lng: 71.6726 },
  { key: "samarqand", label: { uz: "Samarqand", ru: "Самарканд", en: "Samarkand" }, lat: 39.6542, lng: 66.9597 },
  { key: "buxoro", label: { uz: "Buxoro", ru: "Бухара", en: "Bukhara" }, lat: 39.7747, lng: 64.4286 },
  { key: "xorazm", label: { uz: "Xorazm", ru: "Хорезм", en: "Khorezm" }, lat: 41.5500, lng: 60.6333 },
  { key: "qashqadaryo", label: { uz: "Qashqadaryo", ru: "Кашкадарья", en: "Kashkadarya" }, lat: 38.8600, lng: 65.7890 },
  { key: "surxondaryo", label: { uz: "Surxondaryo", ru: "Сурхандарья", en: "Surkhandarya" }, lat: 37.2242, lng: 67.2783 },
  { key: "navoiy", label: { uz: "Navoiy", ru: "Навои", en: "Navoi" }, lat: 40.0844, lng: 65.3792 },
  { key: "jizzax", label: { uz: "Jizzax", ru: "Джизак", en: "Jizzakh" }, lat: 40.1158, lng: 67.8422 },
  { key: "sirdaryo", label: { uz: "Sirdaryo", ru: "Сырдарья", en: "Syrdarya" }, lat: 40.4900, lng: 68.7800 },
  { key: "qoraqalpogiston", label: { uz: "Qoraqalpog'iston", ru: "Каракалпакстан", en: "Karakalpakstan" }, lat: 42.4600, lng: 59.6100 },
];

export function resolveProvince(key: string | undefined) {
  if (!key) return undefined;
  const k = key.trim().toLowerCase().replace(/[’'`ʻ]/g, "").replace(/\s+/g, "-");
  return PROVINCES.find((p) => p.key === k);
}

/** Approximate centres of Tashkent districts — used when a buyer gives a district, not GPS. */
export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  tashkent: { lat: 41.3111, lng: 69.2797 },
  chilanzar: { lat: 41.2755, lng: 69.2042 },
  yunusabad: { lat: 41.3651, lng: 69.2874 },
  mirabad: { lat: 41.2957, lng: 69.2833 },
  yakkasaray: { lat: 41.2905, lng: 69.2585 },
  shaykhantahur: { lat: 41.3235, lng: 69.2333 },
  almazar: { lat: 41.3486, lng: 69.2201 },
  sergeli: { lat: 41.2226, lng: 69.2224 },
  bektemir: { lat: 41.2531, lng: 69.3347 },
  uchtepa: { lat: 41.2905, lng: 69.1745 },
  yashnabad: { lat: 41.2907, lng: 69.3168 },
  "mirzo-ulugbek": { lat: 41.3383, lng: 69.3340 },
};

/** Buyer location: district centre if known, else province centre, else Tashkent. */
export function resolveRegion(region: string | undefined, province?: string): { lat: number; lng: number } {
  if (region) {
    const key = region.trim().toLowerCase().replace(/\s+/g, "-");
    if (REGION_CENTERS[key]) return REGION_CENTERS[key];
  }
  const p = resolveProvince(province);
  if (p) return { lat: p.lat, lng: p.lng };
  return REGION_CENTERS.tashkent;
}
