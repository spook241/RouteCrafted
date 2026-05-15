// Google Places API (New) — high-quality metadata for food & accommodation
// Requires GOOGLE_PLACES_API_KEY env var AND GOOGLE_PLACES_ENABLED=true.
// Only activated for categories: restaurant, cafe, bar, bakery, hotel.
//
// Google Places New API:
//   POST https://places.googleapis.com/v1/places:searchText
//   Photo: https://places.googleapis.com/v1/{photoName}/media?maxWidthPx=1200&key=KEY
//
// Next.js fetch cache: 7-day revalidation (604 800 s).

import type { EnrichmentResult } from "./geoapify";

// Categories that benefit from Google Places data
export const GOOGLE_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "hotel",
]);

// ─── Google Places API shapes ─────────────────────────────────────────────────

type GooglePriceLevel =
  | "PRICE_LEVEL_UNSPECIFIED"
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: GooglePriceLevel;
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  photos?: Array<{ name: string }>;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
}

// ─── Price level mapping ──────────────────────────────────────────────────────

const PRICE_LEVEL_MAP: Partial<Record<GooglePriceLevel, number>> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Look up a food/accommodation place via the Google Places API (New).
 * Returns null when:
 *  - GOOGLE_PLACES_ENABLED is not "true"
 *  - GOOGLE_PLACES_API_KEY is absent
 *  - Category is not in GOOGLE_CATEGORIES
 *  - No place found or any error occurs
 */
export async function searchGoogle(
  name: string,
  destination: string,
  lat: number,
  lon: number,
  category?: string,
): Promise<EnrichmentResult | null> {
  if (process.env.GOOGLE_PLACES_ENABLED !== "true") return null;

  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return null;

  if (category && !GOOGLE_CATEGORIES.has(category)) return null;

  try {
    // ── Text search ────────────────────────────────────────────────────────
    const searchRes = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.rating",
            "places.userRatingCount",
            "places.priceLevel",
            "places.location",
            "places.currentOpeningHours.weekdayDescriptions",
            "places.photos",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery: `${name} ${destination}`,
          maxResultCount: 1,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lon },
              radius: 5000,
            },
          },
        }),
        next: { revalidate: 604_800 }, // 7 days
      },
    );

    if (!searchRes.ok) return null;

    const data: GoogleSearchResponse = await searchRes.json();
    const place = data.places?.[0];
    if (!place) return null;

    // ── Photo URL ──────────────────────────────────────────────────────────
    let imageUrl: string | undefined;
    let imageAttribution: string | undefined;
    const photoName = place.photos?.[0]?.name;
    if (photoName) {
      // Photo media endpoint — no separate fetch needed, construct URL directly
      imageUrl =
        `https://places.googleapis.com/v1/${photoName}/media` +
        `?maxWidthPx=1200&skipHttpRedirect=true&key=${key}`;
      imageAttribution = "Photo via Google Places";
    }

    return {
      source: "google",
      category,
      lat: place.location?.latitude,
      lon: place.location?.longitude,
      providerId: place.id,
      rating:
        typeof place.rating === "number"
          ? Math.round(place.rating * 10) / 10
          : undefined,
      reviewCount: place.userRatingCount,
      priceLevel:
        place.priceLevel != null
          ? PRICE_LEVEL_MAP[place.priceLevel]
          : undefined,
      openingHours: place.currentOpeningHours?.weekdayDescriptions,
      imageUrl,
      imageAttribution,
      imageIsExact: true,
      confidence: 0.9,
    };
  } catch {
    return null;
  }
}
