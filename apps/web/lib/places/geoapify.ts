// Geoapify Places API — POI metadata enrichment
// Requires GEOAPIFY_API_KEY env var; returns null when absent or on error.
//
// Free tier: 3 000 req/day — enough for typical itinerary workloads.
// Next.js fetch cache: 14-day revalidation (1 209 600 s).

export interface EnrichmentResult {
  /** Provider that supplied this result */
  source: "geoapify" | "wikimedia" | "pexels" | "google";
  /** Normalised place category matching itineraryItems.category enum */
  category?: string;
  lat?: number;
  lon?: number;
  /** Provider's stable place ID */
  providerId?: string;
  rating?: number;
  reviewCount?: number;
  /** 1–4 ($ to $$$$) */
  priceLevel?: number;
  /** Array of human-readable hour strings, e.g. ["Mon-Fri 09:00-18:00"] */
  openingHours?: string[];
  imageUrl?: string;
  imageAttribution?: string;
  /** True when the image depicts the exact named place */
  imageIsExact: boolean;
  /** 0–1 confidence score */
  confidence: number;
}

// ─── Geoapify API shapes ──────────────────────────────────────────────────────

interface GeoPlace {
  place_id: string;
  name?: string;
  categories?: string[];
  lat: number;
  lon: number;
  datasource?: {
    sourcename?: string;
    attribution?: string;
    raw?: {
      amenity?: string;
      tourism?: string;
      shop?: string;
      cuisine?: string;
      "stars:official"?: number;
      stars?: number;
      opening_hours?: string;
      website?: string;
    };
  };
  /** Geoapify sometimes nests OSM tags here */
  details?: {
    opening_hours?: string;
    rating?: number;
    catering?: { rating?: number; reviews?: number; price_level?: number };
  };
}

interface GeoApiResponse {
  features?: Array<{
    properties: GeoPlace;
  }>;
}

// ─── Category normalisation ───────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  "catering.restaurant": "restaurant",
  "catering.cafe": "cafe",
  "catering.bar": "bar",
  "catering.bakery": "bakery",
  "catering.fast_food": "restaurant",
  "tourism.attraction": "attraction",
  "tourism.sights.museum": "museum",
  "tourism.sights.ruins": "historic",
  "tourism.sights.castle": "historic",
  "tourism.sights.monument": "landmark",
  "tourism.sights.memorial": "landmark",
  "tourism.sights.archaeological_site": "historic",
  "tourism.sights.place_of_worship": "landmark",
  "tourism.sights.artwork": "attraction",
  "tourism.sights.viewpoint": "viewpoint",
  "tourism.sights": "attraction",
  "leisure.park": "park",
  "leisure.garden": "park",
  "leisure.nature_reserve": "nature",
  "leisure.beach": "beach",
  "leisure.beach_resort": "beach",
  "leisure.shopping_mall": "shopping",
  "commercial.shopping_mall": "shopping",
  "commercial.marketplace": "shopping",
  "accommodation.hotel": "hotel",
  "accommodation.hostel": "hotel",
  "accommodation.apartment": "hotel",
  "public_transport": "transport",
  "heritage": "historic",
};

function mapCategory(categories: string[]): string | undefined {
  for (const cat of categories) {
    // Try longest match first
    const key = Object.keys(CATEGORY_MAP)
      .filter((k) => cat.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (key) return CATEGORY_MAP[key];
  }
  return undefined;
}

// ─── Opening hours ────────────────────────────────────────────────────────────

function parseOpeningHours(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  // OSM opening_hours can be "Mo-Fr 09:00-18:00; Sa 10:00-14:00"
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Price level ─────────────────────────────────────────────────────────────

function parsePriceLevel(raw?: GeoPlace["datasource"]): number | undefined {
  const stars =
    raw?.raw?.["stars:official"] ?? raw?.raw?.["stars"];
  if (typeof stars === "number" && stars >= 1 && stars <= 5) {
    // Map hotel stars 1-5 → price level 1-4
    return Math.min(4, Math.ceil(stars / 1.25));
  }
  return undefined;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Look up a place by name + coordinates via Geoapify Places API.
 * Returns null when the API key is absent, the place is not found, or an
 * error occurs — callers should fall through to the next provider.
 */
export async function searchGeoapify(
  name: string,
  lat: number,
  lon: number,
  category?: string,
): Promise<EnrichmentResult | null> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) return null;

  try {
    // Build categories filter from our category enum → Geoapify categories
    const filterCategories = buildCategoryFilter(category);

    const params = new URLSearchParams({
      name: name,
      filter: `circle:${lon},${lat},2000`, // 2 km radius
      limit: "1",
      apiKey: key,
    });
    if (filterCategories) {
      params.set("categories", filterCategories);
    }

    const url = `https://api.geoapify.com/v2/places?${params.toString()}`;

    const res = await fetch(url, {
      next: { revalidate: 1_209_600 }, // 14 days
    });

    if (!res.ok) return null;

    const data: GeoApiResponse = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    const place = feature.properties;
    const categories = place.categories ?? [];

    const openingHoursRaw =
      place.datasource?.raw?.opening_hours ??
      place.details?.opening_hours;

    const catering = place.details?.catering;
    const rating =
      catering?.rating ?? place.details?.rating;
    const reviewCount = catering?.reviews;
    const priceLevel =
      catering?.price_level ?? parsePriceLevel(place.datasource);

    return {
      source: "geoapify",
      category: mapCategory(categories) ?? category,
      lat: place.lat,
      lon: place.lon,
      providerId: place.place_id,
      rating: typeof rating === "number" ? Math.round(rating * 10) / 10 : undefined,
      reviewCount: typeof reviewCount === "number" ? reviewCount : undefined,
      priceLevel: typeof priceLevel === "number" ? priceLevel : undefined,
      openingHours: parseOpeningHours(openingHoursRaw),
      // Geoapify Places API does not return images — handled by Wikimedia/Pexels
      imageUrl: undefined,
      imageAttribution: undefined,
      imageIsExact: false,
      confidence: 0.7,
    };
  } catch {
    return null;
  }
}

// ─── Category → Geoapify filter ───────────────────────────────────────────────

function buildCategoryFilter(category?: string): string | undefined {
  const map: Record<string, string> = {
    museum: "tourism.sights.museum",
    landmark: "tourism.sights",
    historic: "heritage",
    park: "leisure.park",
    nature: "leisure.nature_reserve",
    restaurant: "catering.restaurant",
    cafe: "catering.cafe",
    bar: "catering.bar",
    bakery: "catering.bakery",
    hotel: "accommodation.hotel",
    shopping: "commercial.shopping_mall",
    beach: "leisure.beach",
    viewpoint: "tourism.sights.viewpoint",
    attraction: "tourism.attraction",
  };
  return category ? map[category] : undefined;
}
