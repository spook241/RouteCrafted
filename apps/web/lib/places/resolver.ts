// Enrichment resolver — orchestrates the provider chain for a single place.
//
// Chain order:
//   1. DB cache  (fastest — skip all network calls)
//   2. Google    → high-quality metadata + photo for food/hotel (flag-guarded)
//   3. Geoapify  → POI metadata (rating, hours, coordinates, price level)
//   4. Wikimedia → exact place image (landmarks, museums, parks …)
//   5. Pexels    → generic category stock photo (last resort)
//   6. Write combined result back to DB cache
//
// The resolver is called from the generate-cards route (Phase 7).
// It never throws — all errors are caught inside providers.

import { searchGeoapify, type EnrichmentResult } from "./geoapify";
import { searchWikimedia } from "./wikimedia";
import { searchPexels } from "./pexels";
import { searchGoogle, GOOGLE_CATEGORIES } from "./google";
import { getCachedEnrichment, insertEnrichmentCache } from "@/lib/db/places";

// ─── Cache TTLs (milliseconds) ────────────────────────────────────────────────

const TTL_MS: Record<string, number> = {
  google:   7  * 24 * 60 * 60 * 1000,  // 7 days
  geoapify: 14 * 24 * 60 * 60 * 1000,  // 14 days
  wikimedia: 30 * 24 * 60 * 60 * 1000, // 30 days
  pexels:   7  * 24 * 60 * 60 * 1000,  // 7 days
};

function ttlFor(source: string): number {
  return TTL_MS[source] ?? TTL_MS.geoapify;
}

// ─── Name normalisation ───────────────────────────────────────────────────────

export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Resolver input ───────────────────────────────────────────────────────────

export interface ResolveInput {
  name: string;
  destination: string;
  /** Trip-level coordinates used as search anchor */
  lat: number;
  lon: number;
  /** Category from itineraryItems.category (may be undefined for old rows) */
  category?: string;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Resolve enrichment data for a single place.
 * Always returns an object — fields are undefined when unavailable.
 * Never throws.
 */
export async function resolveEnrichment(
  input: ResolveInput,
): Promise<EnrichmentResult> {
  const { name, destination, lat, lon, category } = input;
  const nameNorm = normalizePlaceName(name);

  console.log(`[enrichment] resolving "${name}" (${category ?? "no-category"}) in ${destination}`);

  // ── 1. DB cache check ────────────────────────────────────────────────────
  const cached = await getCachedEnrichment(nameNorm, destination, category).catch(() => null);
  if (cached) {
    console.log(`[enrichment] cache HIT — imageUrl: ${cached.imageUrl ?? "null"}`);
    return {
      source: cached.provider as EnrichmentResult["source"],
      category: cached.category ?? category,
      lat: cached.lat ? Number(cached.lat) : undefined,
      lon: cached.lon ? Number(cached.lon) : undefined,
      providerId: cached.providerId ?? undefined,
      rating: cached.rating ? Number(cached.rating) : undefined,
      reviewCount: cached.reviewCount ?? undefined,
      priceLevel: cached.priceLevel ?? undefined,
      openingHours: undefined, // not stored in cache — re-fetch if needed
      imageUrl: cached.imageUrl ?? undefined,
      imageAttribution: cached.imageAttribution ?? undefined,
      imageIsExact: cached.imageIsExact ?? false,
      confidence: 1.0, // from cache — highest confidence
    };
  }

  console.log(`[enrichment] cache MISS — running provider chain`);

  // ── 2. Google Places — food/hotel metadata + photo (flag-guarded) ────────
  const google =
    category && GOOGLE_CATEGORIES.has(category)
      ? await searchGoogle(name, destination, lat, lon, category)
      : null;
  console.log(`[enrichment] google: ${google ? `rating=${google.rating ?? "null"} imageUrl=${google.imageUrl ? "yes" : "null"}` : "skipped/null"}`);

  // If Google returned a full result (metadata + image), we can skip Geoapify
  // and the image providers for this category — Google is authoritative.
  if (google?.rating != null || google?.imageUrl) {
    const combined: EnrichmentResult = {
      ...google,
      confidence: google.confidence,
    };

    const expiresAt = new Date(Date.now() + TTL_MS.google);
    await insertEnrichmentCache({
      placeNameNormalized: nameNorm,
      destination,
      category: combined.category ?? null,
      provider: "google",
      providerId: combined.providerId ?? null,
      lat: combined.lat != null ? String(combined.lat) : null,
      lon: combined.lon != null ? String(combined.lon) : null,
      rating: combined.rating != null ? String(combined.rating) : null,
      reviewCount: combined.reviewCount ?? null,
      priceLevel: combined.priceLevel ?? null,
      imageUrl: combined.imageUrl ?? null,
      imageAttribution: combined.imageAttribution ?? null,
      imageSource: "google",
      imageIsExact: true,
      rawPayload: null,
      expiresAt,
    }).catch(() => {
      console.warn("[enrichment] cache write failed for", nameNorm);
    });

    return combined;
  }

  // ── 3. Geoapify — POI metadata ───────────────────────────────────────────
  const geo = await searchGeoapify(name, lat, lon, category);
  console.log(`[enrichment] geoapify: ${geo ? `category=${geo.category} rating=${geo.rating ?? "null"}` : "null"}`);

  // ── 4. Wikimedia — exact image ───────────────────────────────────────────
  let imageResult: Pick<
    EnrichmentResult,
    "imageUrl" | "imageAttribution" | "imageIsExact" | "source"
  > | null = null;

  const wiki = await searchWikimedia(name, destination, category);
  console.log(`[enrichment] wikimedia: ${wiki?.imageUrl ? `imageUrl=yes` : "null"}`);
  if (wiki?.imageUrl) {
    imageResult = {
      source: "wikimedia",
      imageUrl: wiki.imageUrl,
      imageAttribution: wiki.imageAttribution,
      imageIsExact: true,
    };
  }

  // ── 5. Pexels — stock photo fallback ─────────────────────────────────────
  if (!imageResult) {
    const pex = await searchPexels(name, destination, category);
    console.log(`[enrichment] pexels: ${pex?.imageUrl ? `imageUrl=yes` : "null"}`);
    if (pex?.imageUrl) {
      imageResult = {
        source: "pexels",
        imageUrl: pex.imageUrl,
        imageAttribution: pex.imageAttribution,
        imageIsExact: false,
      };
    }
  }

  console.log(`[enrichment] final — imageSource: ${imageResult?.source ?? "none"} imageUrl: ${imageResult?.imageUrl ? "yes" : "null"}`);

  // ── 6. Combine into a single result ─────────────────────────────────────
  // Primary source = geo if available, else image source, else a bare fallback
  const primarySource: EnrichmentResult["source"] =
    geo?.source ?? imageResult?.source ?? "geoapify";

  const combined: EnrichmentResult = {
    source: primarySource,
    category: geo?.category ?? category,
    lat: geo?.lat,
    lon: geo?.lon,
    providerId: geo?.providerId,
    rating: geo?.rating,
    reviewCount: geo?.reviewCount,
    priceLevel: geo?.priceLevel,
    openingHours: geo?.openingHours,
    imageUrl: imageResult?.imageUrl,
    imageAttribution: imageResult?.imageAttribution,
    imageIsExact: imageResult?.imageIsExact ?? false,
    confidence: Math.max(geo?.confidence ?? 0, wiki?.confidence ?? 0, 0),
  };

  // ── 7. Write to cache ────────────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + ttlFor(imageResult?.source ?? "geoapify"));

  await insertEnrichmentCache({
    placeNameNormalized: nameNorm,
    destination,
    category: combined.category ?? null,
    provider: primarySource,
    providerId: combined.providerId ?? null,
    lat: combined.lat != null ? String(combined.lat) : null,
    lon: combined.lon != null ? String(combined.lon) : null,
    rating: combined.rating != null ? String(combined.rating) : null,
    reviewCount: combined.reviewCount ?? null,
    priceLevel: combined.priceLevel ?? null,
    imageUrl: combined.imageUrl ?? null,
    imageAttribution: combined.imageAttribution ?? null,
    imageSource: imageResult?.source ?? null,
    imageIsExact: combined.imageIsExact,
    rawPayload: null,
    expiresAt,
  }).catch(() => {
    // Cache write failure is non-fatal — log silently
    console.warn("[enrichment] cache write failed for", nameNorm);
  });

  return combined;
}
