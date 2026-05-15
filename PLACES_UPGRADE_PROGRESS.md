# Places Enrichment Upgrade — Progress

## Current Status

**Active phase:** ✅ All phases complete

## Phase Checklist

| Phase | Title | Status | Notes |
|---|---|---|---|
| 0 | Create progress tracking file | ✅ Done | This file |
| 1 | Schema upgrade (itineraryItems + placeCards + placeEnrichmentCache) | ✅ Done | Migration `0002_parched_slyde.sql` applied. DB verified. |
| 2 | AI itinerary returns category per item | ✅ Done | DB prompt updated to v2 |
| 3 | Geoapify/OSM metadata provider | ✅ Done | `lib/places/geoapify.ts` created |
| 4 | Wikimedia/Wikipedia landmark images | ✅ Done | `lib/places/wikimedia.ts` created |
| 5 | Pexels generic image fallback | ✅ Done | `lib/places/pexels.ts` created |
| 6 | Resolver orchestrator | ✅ Done | `lib/places/resolver.ts` created |
| 7 | Update generate-cards route | ✅ Done | `searchPoi` replaced with `resolveEnrichment` |
| 8 | Google Places (flag-guarded, food/hotel only) | ✅ Done | `lib/places/google.ts` created, resolver updated |
| 9 | PlaceCard conditional rating display | ✅ Done | `PlaceCard.tsx` updated |
| 10 | Admin enrichment visibility | ✅ Done | `AdminFlagRow.tsx` updated |

---

## Phase Notes

### Phase 0 — ✅ Done
Created `PLACES_UPGRADE_PROGRESS.md` at repo root.

### Phase 8 — ✅ Done

**What changed:**

- `apps/web/lib/places/google.ts`: NEW — `searchGoogle(name, destination, lat, lon, category?)` function
  - Uses Google Places API (New): `POST places.googleapis.com/v1/places:searchText`
  - `X-Goog-FieldMask` requests: id, displayName, rating, userRatingCount, priceLevel, location, currentOpeningHours.weekdayDescriptions, photos
  - `locationBias.circle` = 5 km radius around trip coordinates
  - Photo URL constructed from `places/{id}/photos/{ref}/media?maxWidthPx=1200`
  - Price level enum mapped: INEXPENSIVE=1, MODERATE=2, EXPENSIVE=3, VERY_EXPENSIVE=4
  - `imageIsExact: true`, `confidence: 0.9`
  - Returns `null` when `GOOGLE_PLACES_ENABLED !== "true"`, key absent, wrong category, or no result
  - Exports `GOOGLE_CATEGORIES` Set (`restaurant`, `cafe`, `bar`, `bakery`, `hotel`)
- `apps/web/lib/places/resolver.ts`: updated
  - Imports `searchGoogle` + `GOOGLE_CATEGORIES`
  - Added TTL entry: `google: 7 days`
  - Step 2 (new): calls Google for relevant categories; if result has rating or image, writes to cache and **returns early** (skips Geoapify + Wikimedia + Pexels)
  - Steps 3–7 renumbered (Geoapify, Wikimedia, Pexels, combine, write cache)
- `.env.local`: added `GOOGLE_PLACES_ENABLED=false` + `GOOGLE_PLACES_API_KEY=` placeholder

---

### Phase 7 — ✅ Done

**What changed:**

- `app/api/places/generate-cards/route.ts`:
  - Removed `import { searchPoi } from "@/lib/places/opentripmap"`
  - Added `import { resolveEnrichment } from "@/lib/places/resolver"`
  - Replaced the `searchPoi()` block with `resolveEnrichment({ name, destination, lat, lon, category })`
  - `insertPlaceCard()` now receives all 11 enrichment fields: `rating`, `reviewCount`, `priceLevel`, `openingHours`, `imageSource`, `imageAttribution`, `imageIsExact`, `enrichmentConfidence`, `externalSource`, `externalPlaceId`, `enrichedAt`
  - Category derived from `enrichment.category ?? item.category ?? "attraction"` (AI-supplied category takes precedence)
  - `tripLat ?? 0` / `tripLon ?? 0` ensures resolver always gets numeric coords (resolver chains gracefully on zero coords)

---

### Phase 6 — ✅ Done

**What changed:**

- `apps/web/lib/places/resolver.ts`: NEW — `resolveEnrichment(input)` orchestrator
  - Input: `{ name, destination, lat, lon, category? }`
  - Step 1: `getCachedEnrichment()` — returns immediately on cache hit (confidence 1.0)
  - Step 2: `searchGeoapify()` — POI metadata (rating, hours, coords, price level)
  - Step 3: `searchWikimedia()` — exact place image (landmarks/museums/parks only)
  - Step 4: `searchPexels()` — stock photo fallback if Wikimedia has no image
  - Step 5: Combines geo metadata + best image into single `EnrichmentResult`
  - Step 6: `insertEnrichmentCache()` — TTL per image source (geo=14d, wiki=30d, pexels=7d); write failure is non-fatal
  - Also exports `normalizePlaceName()` helper (lowercase, strip punctuation, collapse spaces)
  - Never throws — all provider errors caught internally

---

### Phase 5 — ✅ Done

**What changed:**

- `apps/web/lib/places/pexels.ts`: NEW — `searchPexels(name, destination, category?)` function
  - Maps 17 category values → tuned Pexels search queries (e.g. `museum` → `"museum interior art gallery"`)
  - Prefixes query with `destination` for relevance
  - `per_page: 1`, `orientation: landscape`
  - `imageIsExact: false`, `confidence: 0.3` (stock photo fallback, lowest priority)
  - Attribution: `"Photo by {photographer} on Pexels"`
  - `next: { revalidate: 604_800 }` (7 days)
  - Returns `null` when key absent or no photos found
- `.env.local`: added `PEXELS_API_KEY=` placeholder

---

### Phase 4 — ✅ Done

**What changed:**

- `apps/web/lib/places/wikimedia.ts`: NEW — `searchWikimedia(name, destination, category?)` function
  - Skips non-Wikipedia categories (restaurant/cafe/bar/bakery/hotel/transport) — returns `null` immediately
  - Step 1: Wikipedia Action API search (`srsearch: "NAME DESTINATION", srlimit: 1`) to find article title
  - Step 2: Wikipedia REST `page/summary/{title}` to get `thumbnail.source` / `originalimage.source`
  - Attribution: `"Image via Wikipedia — {title} (CC BY-SA)"`
  - `imageIsExact: true`, `confidence: 0.6`
  - `next: { revalidate: 2_592_000 }` (30 days) on both fetches
  - No API key required

---

### Phase 3 — ✅ Done

**What changed:**

- `apps/web/lib/places/geoapify.ts`: NEW — `searchGeoapify(name, lat, lon, category?)` function
  - Defines shared `EnrichmentResult` interface (source, category, lat, lon, providerId, rating, reviewCount, priceLevel, openingHours, imageUrl, imageAttribution, imageIsExact, confidence)
  - Calls `https://api.geoapify.com/v2/places` with 2 km radius circle filter
  - Maps Geoapify categories → our 17-value category enum
  - Parses OSM opening_hours string into `string[]`
  - Extracts catering ratings, review counts, price levels, hotel star → price level mapping
  - `next: { revalidate: 1_209_600 }` (14-day HTTP cache)
  - Returns `null` when key absent or place not found — safe to chain
- `.env.local`: added `GEOAPIFY_API_KEY=` placeholder

---

### Phase 2 — ✅ Done

**What changed:**

- `lib/ai/schemas.ts`: added `category: z.string().optional()` to `itineraryItemSchema`
- `lib/db/itinerary.ts`: added `category?: string | null` to `insertItems()` row type
- `app/api/itinerary/generate/route.ts`: passes `category: item.category ?? null` in bulk insert
- `lib/db/ai-config.ts`: updated `DEFAULT_GENERATE_TEMPLATE` to include `category` enum in item spec
- `scripts/update-generate-prompt-v2.ts`: one-time script to insert v2 prompt + activate (already run)
- **DB:** `generate_itinerary` v2 inserted and activated (v1 deactivated) — confirmed via script output

---

### Phase 1 — ✅ Done

**What changed:**

- `itineraryItems`: added `category text` nullable
- `placeCards`: added 11 enrichment columns — `rating`, `reviewCount`, `priceLevel`, `openingHours`, `imageSource`, `imageAttribution`, `imageIsExact`, `enrichmentConfidence`, `externalSource`, `externalPlaceId`, `enrichedAt`
- New `placeEnrichmentCache` table (18 columns)
- `apps/web/lib/db/places.ts`: extended `PlaceCardInsert` + `insertPlaceCard()`, added `EnrichmentCacheInsert` type + `getCachedEnrichment()` + `insertEnrichmentCache()`
- Migration `drizzle/0002_parched_slyde.sql` generated and applied
- **Verified:** queried DB — all 9 targeted columns confirmed present, `place_enrichment_cache` table exists

---

_Updated after each phase. Legend: ✅ Done · 🔄 In progress · ❌ Failed · ⬜ Not started_
