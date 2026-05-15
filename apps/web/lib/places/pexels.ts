// Pexels image search — generic category-level fallback
// Requires PEXELS_API_KEY env var; returns null when absent or on error.
//
// Used as the last image fallback when Wikimedia has no result.
// Pexels is NOT place-specific — imageIsExact is always false.
//
// Free tier: 200 req/hour, 20 000 req/month — more than sufficient.
// Next.js fetch cache: 7-day revalidation (604 800 s).

import type { EnrichmentResult } from "./geoapify";

// ─── Pexels API shapes ────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
  alt?: string;
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
  total_results?: number;
}

// ─── Category → search query ──────────────────────────────────────────────────

const CATEGORY_QUERIES: Record<string, string> = {
  city: "city skyline travel destination",
  museum: "museum interior art gallery",
  landmark: "famous landmark architecture",
  historic: "historic building ancient ruins",
  park: "city park green nature",
  nature: "scenic nature landscape",
  restaurant: "restaurant dining food",
  cafe: "cafe coffee shop",
  bar: "bar cocktail nightlife",
  bakery: "bakery pastry bread",
  hotel: "hotel lobby luxury",
  neighborhood: "city street neighborhood",
  shopping: "shopping street market",
  beach: "tropical beach ocean",
  viewpoint: "scenic viewpoint panorama",
  activity: "travel adventure activity",
  attraction: "travel tourist attraction",
  transport: "train station transport",
};

function buildSearchQuery(name: string, destination: string, category?: string): string {
  const base = category ? CATEGORY_QUERIES[category] ?? "travel destination" : "travel destination";
  if (category === "city") {
    // Include country for disambiguation (e.g. "Sidney Canada" not just "Sidney")
    return `${name} ${destination} ${base}`;
  }
  // For specific places use just the name — the category provides context
  return `${name} ${base}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Search Pexels for a generic image matching the place's category.
 * Always sets imageIsExact = false — this is a stock photo fallback.
 * Returns null when the API key is absent or no photos are found.
 */
export async function searchPexels(
  name: string,
  destination: string,
  category?: string,
): Promise<EnrichmentResult | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;

  try {
    const query = buildSearchQuery(name, destination, category);

    const params = new URLSearchParams({
      query,
      per_page: "1",
      orientation: "landscape",
    });

    const res = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      {
        headers: { Authorization: key },
        next: { revalidate: 604_800 }, // 7 days
      },
    );

    if (!res.ok) return null;

    const data: PexelsSearchResponse = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    // Prefer large2x for quality, fall back to large
    const imageUrl = photo.src.large2x ?? photo.src.large;

    return {
      source: "pexels",
      category,
      imageUrl,
      imageAttribution: `Photo by ${photo.photographer} on Pexels`,
      imageIsExact: false,
      confidence: 0.3,
    };
  } catch {
    return null;
  }
}
