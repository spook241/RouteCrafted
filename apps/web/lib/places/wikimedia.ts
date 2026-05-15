// Wikimedia / Wikipedia image enrichment
// No API key required. Uses the public Wikipedia Action API + REST summary API.
// Best for: museums, landmarks, historic sites, parks, viewpoints, attractions.
// Not useful for restaurants, cafes, bars, or bakeries (Wikipedia rarely covers them).
//
// Next.js fetch cache: 30-day revalidation (2 592 000 s).

import type { EnrichmentResult } from "./geoapify";

// Categories for which Wikipedia is likely to have a dedicated article + image
const WIKI_RELEVANT_CATEGORIES = new Set([
  "museum",
  "landmark",
  "historic",
  "park",
  "nature",
  "beach",
  "viewpoint",
  "attraction",
  "neighborhood",
  "shopping",
]);

// ─── Wikipedia Action API shapes ──────────────────────────────────────────────

interface WikiSearchResult {
  query?: {
    search?: Array<{ title: string; snippet: string }>;
  };
}

interface WikiSummary {
  title?: string;
  description?: string;          // e.g. "Canadian professional ice hockey player"
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * PRIMARY: Search Wikipedia by geographic coordinates (geosearch).
 * Returns the photo from the nearest Wikipedia article to the given coords.
 * This always resolves to the actual city/place — never a person.
 */
export async function searchWikimediaByCoords(
  lat: string,
  lon: string,
): Promise<EnrichmentResult | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      list: "geosearch",
      gscoord: `${lat}|${lon}`,
      gsradius: "10000",  // 10 km radius — large enough to find any city center
      gslimit: "5",
      format: "json",
      origin: "*",
    });

    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?${params.toString()}`,
      { next: { revalidate: 2_592_000 } },
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      query?: { geosearch?: Array<{ title: string }> };
    };
    const hits = data.query?.geosearch ?? [];
    if (hits.length === 0) return null;

    // Try each nearby article until we find one with a usable landscape photo
    for (const hit of hits) {
      const result = await tryTitle(hit.title, "landmark");
      if (result) return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * FALLBACK: Search Wikipedia by text (city name + country).
 * Less reliable — may return person articles for ambiguous names.
 */
export async function searchWikimedia(
  name: string,
  destination: string,
  category?: string,
): Promise<EnrichmentResult | null> {
  // Skip categories where Wikipedia is rarely useful
  if (category && !WIKI_RELEVANT_CATEGORIES.has(category)) return null;

  try {
    // Step 1 — find the closest Wikipedia article titles (up to 5)
    const titles = await findWikipediaTitle(name, destination);
    if (!titles || titles.length === 0) return null;

    // Step 2 — try each candidate title until we find a usable photo
    for (const title of titles) {
      const result = await tryTitle(title, category);
      if (result) return result;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return true when the URL looks like a heraldic / non-photographic image
 * (flag, coat of arms, emblem, seal, shield, logo).
 * These appear as the main infobox image in Wikipedia city/country articles.
 */
function isHeraldicImage(url: string): boolean {
  const lower = url.toLowerCase();
  const BLOCKED_TERMS = [
    "flag_of", "flag-of", "flagof",
    "coat_of_arms", "coatofarms", "coat-of-arms",
    "emblem_of", "emblem-of",
    "seal_of", "seal-of",
    "shield_of", "shield-of",
    "logo_of", "logo-of",
    "_flag.", "-flag.",
    "national_symbol",
    ".svg",           // most heraldic images are SVG
  ];
  return BLOCKED_TERMS.some((term) => lower.includes(term));
}

// Wikipedia article descriptions that confirm a geographic place article
const GEO_DESCRIPTION_TERMS = [
  "city", "town", "municipality", "village", "borough",
  "commune", "capital", "district", "county", "province",
  "island", "peninsula", "region", "township", "settlement",
  "port", "metro", "urban", "suburb", "neighbourhood", "neighborhood",
  "arrondissement", "parish", "canton", "prefect",
];

/** Return true only when the description clearly identifies a geographic place. */
function isGeographicDescription(description?: string): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return GEO_DESCRIPTION_TERMS.some((t) => lower.includes(t));
}

/**
 * Try a single Wikipedia title and return an EnrichmentResult if it passes
 * all quality checks (not a person, not heraldic, landscape orientation).
 */
async function tryTitle(title: string, category?: string) {
  const summary = await fetchPageSummary(title);
  if (!summary?.thumbnail?.source) return null;

  // *** Whitelist: only accept if description explicitly identifies a geographic place.
  // This rejects persons, buildings, events, post offices, teams, etc.
  if (!isGeographicDescription(summary.description)) return null;

  const imageUrl = summary.originalimage?.source ?? summary.thumbnail.source;

  // Reject heraldic images
  if (isHeraldicImage(imageUrl)) return null;

  // Reject portrait orientation
  if (summary.thumbnail.height > summary.thumbnail.width) return null;

  return {
    source: "wikimedia" as const,
    category,
    imageUrl,
    imageAttribution: `Image via Wikipedia — ${title} (CC BY-SA)`,
    imageIsExact: true,
    confidence: 0.6,
  };
}

async function findWikipediaTitle(
  name: string,
  destination: string,
): Promise<string[] | null> {
  // Add geographic context to bias results toward place articles over people
  const query = `${name}, ${destination} city`;
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "5",
    srnamespace: "0",
    format: "json",
    origin: "*",
  });

  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    { next: { revalidate: 2_592_000 } },
  );

  if (!res.ok) return null;

  const data: WikiSearchResult = await res.json();
  const results = data.query?.search ?? [];
  if (results.length === 0) return null;

  // Prefer articles whose title contains the city name (exact geographic match)
  const nameLower = name.toLowerCase();
  const geographic = results
    .map((r) => r.title)
    .filter((t) => t.toLowerCase().includes(nameLower));

  // Return geographic matches first, then fall back to all results
  return geographic.length > 0 ? geographic : results.map((r) => r.title);
}

async function fetchPageSummary(title: string): Promise<WikiSummary | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
    { next: { revalidate: 2_592_000 } },
  );

  if (!res.ok) return null;
  return res.json() as Promise<WikiSummary>;
}
