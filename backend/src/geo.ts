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

/** Approximate centres of Tashkent districts — used when a buyer gives a region, not GPS. */
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

export function resolveRegion(region: string | undefined): { lat: number; lng: number } {
  if (!region) return REGION_CENTERS.tashkent;
  const key = region.trim().toLowerCase().replace(/\s+/g, "-");
  return REGION_CENTERS[key] ?? REGION_CENTERS.tashkent;
}
