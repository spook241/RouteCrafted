Below is the technical implementation I would use for RouteCrafted after adding **Google Places / Google services as a minimum-usage premium fallback**.

The architectural principle should be:

> **Free/open data first. Google only when the place is a restaurant/café or when the card quality would visibly suffer without accurate photos/reviews/rating/opening-hours.**

This fits your current RouteCrafted direction: the app already uses AI to generate itineraries and place cards, while external POI services are only enrichment layers. Your current docs still describe OpenTripMap as the POI enrichment source for itinerary generation and place cards, but the better design is to replace it with a provider chain and use Google selectively.

---

# RouteCrafted — Minimum-Usage Google Places Enrichment

## 1. Target architecture

```txt
AI itinerary generation
  ↓
itinerary_items with name, category, location hint
  ↓
Place enrichment resolver
  ↓
Provider chain:
  1. AI category / existing DB cache
  2. Geoapify / OSM metadata
  3. Wikipedia/Wikidata/Wikimedia for landmark images
  4. Pexels/Unsplash for generic fallback images
  5. Google Places only when needed
  ↓
Gemini place-card generation
  ↓
place_cards saved with attribution + source confidence
```

The existing business case says RouteCrafted's value is not a POI database; it is a mobile decision layer with short "worth it / skip it" cards. So Google should not be used on every itinerary item. It should be used only where freshness and user trust matter most: restaurants, cafés, bars, hotels, and ambiguous named places.

---

## 2. Provider responsibility matrix

| Requirement           | Free/default provider        | Google fallback?   | Notes                                                                                              |
|-----------------------|------------------------------|--------------------|-----------------------------------------------------------------------------------------------------|
| Category              | AI enum + Geoapify           | Rarely             | Category does not justify Google cost.                                                              |
| Coordinates           | Nominatim / Geoapify         | Only if unresolved | Your integration docs already use Nominatim for server-side geocoding and Mapbox for autocomplete.  |
| Landmark image        | Wikidata/Wikipedia/Wikimedia | Rarely             | Google only if no image and card is important.                                                      |
| Restaurant/café image | Pexels/Unsplash generic      | **Yes**            | Google gives actual place photos.                                                                   |
| Rating                | None / optional Yelp later   | **Yes**            | Use only for restaurants/cafés or high-priority cards.                                              |
| Reviews               | None by default              | **Yes, limited**   | Google Places can return reviews, but use them carefully and only when requested/needed.            |
| Opening hours         | Geoapify/OSM if present      | **Yes**            | Valuable for restaurants/cafés and "is it worth it now?" cards.                                     |
| Phone/website         | Geoapify/OSM if present      | Optional           | Not essential for MVP cards.                                                                        |

Google's new Places API supports Text Search, Nearby Search, Place Details, and Place Photos. Place Details can return address, phone, user rating, reviews, and related metadata; Google requires field masks so you request only the fields you need. Place Photos is a separate read-only API that returns photographic media from the Places database.

---

## 3. When Google is allowed

```ts
function shouldUseGoogle(input: PlaceEnrichmentInput): boolean {
  if (!process.env.GOOGLE_PLACES_API_KEY) return false;

  if (input.forcePremiumEnrichment) return true;

  const category = input.category;

  const googleValuableCategories = [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "food",
    "hotel",
    "nightlife",
  ];

  if (googleValuableCategories.includes(category)) return true;

  if (input.imageMissing && input.cardPriority === "high") return true;

  if (input.coordinatesMissing && input.matchConfidence === "low") return true;

  return false;
}
```

**Use Google for:** restaurant, cafe, bar, bakery, hotel, named local business, high-priority card with missing image, ambiguous place match.

**Do NOT use Google for:** generic park, neighborhood, free attraction, museum already found in Wikipedia, landmark with Wikidata image, transport item, generic activity.

---

## 4. Environment variables

```env
# Places / POI (free)
GEOAPIFY_API_KEY=
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=

# Google premium fallback
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_ENABLED=true
GOOGLE_PLACES_DAILY_LIMIT=100
GOOGLE_PLACES_MONTHLY_LIMIT=1000
GOOGLE_PLACES_ONLY_FOR_FOOD=true
GOOGLE_PLACES_PHOTOS_ENABLED=true
GOOGLE_PLACES_REVIEWS_ENABLED=true
```

Keep Google server-side only. Never expose the key to the browser/mobile client.

---

## 5. Database schema changes

### `place_cards` additions

```ts
export const placeCards = pgTable("place_cards", {
  // existing fields...

externalSource: varchar("external_source", { length: 40 }),
externalPlaceId: varchar("external_place_id", { length: 200 }),

rating: real("rating"),
reviewCount: integer("review_count"),
priceLevel: varchar("price_level", { length: 30 }),

openingHours: jsonb("opening_hours").$type<{
  weekdayDescriptions?: string[];
  openNow?: boolean;
}>(),

reviewSnippets: jsonb("review_snippets").$type<
  {
    text: string;
    rating?: number;
    authorName?: string;
    relativeTime?: string;
    source: "google" | "yelp" | "internal";
  }[]
>(),

// imageUrl already exists — add attribution fields:
imageSource: varchar("image_source", { length: 40 }),
imageSourceUrl: varchar("image_source_url", { length: 1000 }),
imageAttribution: text("image_attribution"),
imageAuthor: varchar("image_author", { length: 200 }),
imageLicense: varchar("image_license", { length: 100 }),
imageIsExactPlace: boolean("image_is_exact_place").default(false),
imageConfidence: varchar("image_confidence", { length: 20 }).default("low"),

enrichmentStatus: varchar("enrichment_status", { length: 30 }).default("pending"),
enrichmentConfidence: varchar("enrichment_confidence", { length: 20 }).default("low"),
enrichedAt: timestamp("enriched_at"),
```

### Optional cache table

Add a cache so you do not pay repeatedly for the same Google result.

```ts
export const placeEnrichmentCache = pgTable("place_enrichment_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  cacheKey: varchar("cache_key", { length: 300 }).unique().notNull(),
  normalizedName: varchar("normalized_name", { length: 200 }).notNull(),
  destination: varchar("destination", { length: 200 }),
  category: varchar("category", { length: 60 }),
  provider: varchar("provider", { length: 40 }).notNull(),
  providerPlaceId: varchar("provider_place_id", { length: 200 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
```

Suggested TTL:

```txt
Landmarks/Wikipedia images: 30–90 days
Geoapify/OSM metadata: 14–30 days
Google Place Details: 7–14 days
Google photos URI: do not permanently cache temporary media URL; cache photo name/reference instead
```

Google Place Photos returns a `photoUri` for rendering media, so design the cache around the photo resource name/reference and refresh the render URL when needed.

### New table: `google_usage` (quota tracking)

```ts
export const googleUsage = pgTable("google_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: varchar("sku", { length: 60 }).notNull(),
  placeName: varchar("place_name", { length: 200 }),
  providerPlaceId: varchar("provider_place_id", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## 6. Provider chain implementation

Create:

```txt
apps/web/lib/places/
  types.ts
  normalize.ts
  cache.ts
  geoapify.ts
  wikimedia.ts
  pexels.ts
  unsplash.ts
  google-places.ts
  quota.ts
  resolver.ts
```

---

### `types.ts`

```ts
export type PlaceCategory =
  | "museum"
  | "landmark"
  | "historic"
  | "park"
  | "nature"
  | "restaurant"
  | "cafe"
  | "bar"
  | "bakery"
  | "hotel"
  | "neighborhood"
  | "shopping"
  | "beach"
  | "viewpoint"
  | "activity"
  | "attraction";

export type EnrichmentSource =
  | "ai"
  | "geoapify"
  | "wikidata"
  | "wikipedia"
  | "wikimedia_commons"
  | "pexels"
  | "unsplash"
  | "google_places"
  | "fallback";

export type PlaceEnrichmentInput = {
  name: string;
  destination: string;
  country?: string | null;
  category?: PlaceCategory | "unknown";
  locationHint?: string | null;
  lat?: number | null;
  lon?: number | null;
  cardPriority?: "low" | "normal" | "high";
  forcePremiumEnrichment?: boolean;
};

export type ReviewSnippet = {
  text: string;
  rating?: number;
  authorName?: string;
  relativeTime?: string;
  source: "google" | "internal";
};

export type PlaceEnrichmentResult = {
  name: string;
  category: PlaceCategory;
  latitude?: number | null;
  longitude?: number | null;

  externalSource?: EnrichmentSource;
  externalPlaceId?: string | null;

  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: string | null;
  openingHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  } | null;

  reviewSnippets?: ReviewSnippet[];

  imageUrl?: string | null;
  imageSource?: EnrichmentSource;
  imageSourceUrl?: string | null;
  imageAttribution?: string | null;
  imageAuthor?: string | null;
  imageLicense?: string | null;
  imageIsExactPlace: boolean;
  imageConfidence: "high" | "medium" | "low";

  enrichmentConfidence: "high" | "medium" | "low";
};
```

---

## 7. Google quota guard

Never call Google directly from business logic. Route everything through `quota.ts`.

```ts
// lib/places/quota.ts

import { db } from "@/lib/db";
import { googleUsage } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";

export type GoogleSku =
  | "text_search"
  | "nearby_search"
  | "place_details_basic"
  | "place_details_atmosphere"
  | "place_photo";

export async function canUseGoogle(sku: GoogleSku): Promise<boolean> {
  if (process.env.GOOGLE_PLACES_ENABLED !== "true") return false;

  const dailyLimit = Number(process.env.GOOGLE_PLACES_DAILY_LIMIT ?? 100);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await db
    .select()
    .from(googleUsage)
    .where(gte(googleUsage.createdAt, today));

  const usedToday = rows.length;

  return usedToday < dailyLimit;
}

export async function recordGoogleUsage(params: {
  sku: GoogleSku;
  placeName?: string;
  providerPlaceId?: string;
}) {
  await db.insert(googleUsage).values({
    sku: params.sku,
    placeName: params.placeName,
    providerPlaceId: params.providerPlaceId,
  });
}
```

Add table:

```ts
export const googleUsage = pgTable("google_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: varchar("sku", { length: 60 }).notNull(),
  placeName: varchar("place_name", { length: 200 }),
  providerPlaceId: varchar("provider_place_id", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## 8. Google Places minimal client

Google Places API New requires field masks; this is useful because it lets you request only the fields needed for a given use case. Google's docs explicitly describe field masks and pricing tiers for fields.

### `google-places.ts`

```ts
// lib/places/google-places.ts

import { canUseGoogle, recordGoogleUsage } from "./quota";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1/places";

function googleHeaders(fieldMask: string) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
    "X-Goog-FieldMask": fieldMask,
  };
}

export async function googleTextSearchPlace(params: {
  query: string;
  lat?: number | null;
  lon?: number | null;
  includedType?: "restaurant" | "cafe" | "bar" | "bakery" | "tourist_attraction";
}) {
  if (!(await canUseGoogle("text_search"))) return null;

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.primaryType",
  ].join(",");

  const body: Record<string, unknown> = {
    textQuery: params.query,
    maxResultCount: 3,
    languageCode: "en",
  };

  if (params.includedType) {
    body.includedType = params.includedType;
  }

  if (params.lat && params.lon) {
    body.locationBias = {
      circle: {
        center: {
          latitude: params.lat,
          longitude: params.lon,
        },
        radius: 5000,
      },
    };
  }

  const res = await fetch(`${GOOGLE_PLACES_BASE}:searchText`, {
    method: "POST",
    headers: googleHeaders(fieldMask),
    body: JSON.stringify(body),
  });

  await recordGoogleUsage({
    sku: "text_search",
    placeName: params.query,
  });

  if (!res.ok) {
    console.error("Google Text Search failed", await res.text());
    return null;
  }

  const data = await res.json();
  return data.places?.[0] ?? null;
}
```

---

## 9. Google Place Details: two modes

Use two field masks:

### Cheap/basic-ish details

Use this when you only need coordinates and identity.

```ts
const BASIC_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
].join(",");
```

### Premium food/card details

Use this only for restaurants/cafés.

```ts
const FOOD_CARD_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours",
  "regularOpeningHours",
  "photos",
  "reviews",
  "websiteUri",
  "nationalPhoneNumber",
].join(",");
```

Google's Place Details can return rating and reviews, and Google's policy page notes that reviews are included by adding `reviews` to the field mask. Do not treat Google reviews as a full review database. Use them as short snippets, not paginated review mining.

```ts
export async function googlePlaceDetails(params: {
  placeId: string;
  mode: "basic" | "food_card";
}) {
  const sku =
    params.mode === "food_card"
      ? "place_details_atmosphere"
      : "place_details_basic";

  if (!(await canUseGoogle(sku))) return null;

  const fieldMask =
    params.mode === "food_card"
      ? FOOD_CARD_DETAILS_FIELDS
      : BASIC_DETAILS_FIELDS;

  const res = await fetch(`${GOOGLE_PLACES_BASE}/${params.placeId}`, {
    headers: googleHeaders(fieldMask),
  });

  await recordGoogleUsage({
    sku,
    providerPlaceId: params.placeId,
  });

  if (!res.ok) {
    console.error("Google Place Details failed", await res.text());
    return null;
  }

  return res.json();
}
```

---

## 10. Google Place Photos

Use photos only after you have selected a Google place. Google Place Photos provides access to photos stored in the Places database, and the API returns media via the `places/*/photos/*/media` endpoint.

```ts
export async function googlePlacePhotoUrl(params: {
  photoName: string;
  maxWidthPx?: number;
  maxHeightPx?: number;
}) {
  if (process.env.GOOGLE_PLACES_PHOTOS_ENABLED !== "true") return null;
  if (!(await canUseGoogle("place_photo"))) return null;

  const url = new URL(`https://places.googleapis.com/v1/${params.photoName}/media`);
  url.searchParams.set("maxWidthPx", String(params.maxWidthPx ?? 900));
  url.searchParams.set("skipHttpRedirect", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
    },
  });

  await recordGoogleUsage({
    sku: "place_photo",
    providerPlaceId: params.photoName,
  });

  if (!res.ok) {
    console.error("Google Place Photo failed", await res.text());
    return null;
  }

  const data = await res.json();

  return {
    url: data.photoUri as string,
    sourceUrl: `https://www.google.com/maps/place/?q=place_id:${params.photoName}`,
  };
}
```

Practical note: the source URL above should be adjusted to the actual place ID, not the photo name, if you display "view on Google Maps".

---

## 11. Main resolver

```ts
// lib/places/resolver.ts

import type {
  PlaceEnrichmentInput,
  PlaceEnrichmentResult,
  PlaceCategory,
} from "./types";
import { getCachedEnrichment, setCachedEnrichment } from "./cache";
import { searchGeoapifyPlace } from "./geoapify";
import { findWikipediaImage } from "./wikimedia";
import { findPexelsImage } from "./pexels";
import {
  googleTextSearchPlace,
  googlePlaceDetails,
  googlePlacePhotoUrl,
} from "./google-places";

function normalizeCategory(category?: string): PlaceCategory {
  switch (category) {
    case "restaurant":
    case "cafe":
    case "bar":
    case "bakery":
    case "hotel":
    case "museum":
    case "park":
    case "landmark":
    case "historic":
    case "neighborhood":
      return category;
    default:
      return "attraction";
  }
}

function isFoodCategory(category: PlaceCategory) {
  return ["restaurant", "cafe", "bar", "bakery"].includes(category);
}

function shouldUseGooglePremium(input: PlaceEnrichmentInput, partial: Partial<PlaceEnrichmentResult>) {
  if (process.env.GOOGLE_PLACES_ENABLED !== "true") return false;

  const category = normalizeCategory(input.category);

  if (input.forcePremiumEnrichment) return true;

  if (process.env.GOOGLE_PLACES_ONLY_FOR_FOOD === "true") {
    return isFoodCategory(category);
  }

  if (isFoodCategory(category)) return true;

  if (!partial.imageUrl && input.cardPriority === "high") return true;

  return false;
}

export async function enrichPlace(input: PlaceEnrichmentInput): Promise<PlaceEnrichmentResult> {
  const category = normalizeCategory(input.category);
  const cacheKey = `${input.name}|${input.destination}|${category}`.toLowerCase();

  const cached = await getCachedEnrichment(cacheKey);
  if (cached) return cached as PlaceEnrichmentResult;

  let result: PlaceEnrichmentResult = {
    name: input.name,
    category,
    latitude: input.lat ?? null,
    longitude: input.lon ?? null,
    imageUrl: null,
    imageIsExactPlace: false,
    imageConfidence: "low",
    enrichmentConfidence: "low",
  };

  // 1. Free metadata first
  const geo = await searchGeoapifyPlace({
    name: input.name,
    destination: input.destination,
    category,
    lat: input.lat,
    lon: input.lon,
  });

  if (geo) {
    result = {
      ...result,
      latitude: geo.latitude ?? result.latitude,
      longitude: geo.longitude ?? result.longitude,
      externalSource: "geoapify",
      externalPlaceId: geo.placeId,
      enrichmentConfidence: geo.confidence ?? "medium",
    };
  }

  // 2. Exact free image for landmarks
  if (!isFoodCategory(category)) {
    const wikiImage = await findWikipediaImage({
      name: input.name,
      destination: input.destination,
      lat: result.latitude,
      lon: result.longitude,
    });

    if (wikiImage) {
      result = {
        ...result,
        imageUrl: wikiImage.url,
        imageSource: wikiImage.source,
        imageSourceUrl: wikiImage.sourceUrl,
        imageAttribution: wikiImage.attribution,
        imageAuthor: wikiImage.author,
        imageLicense: wikiImage.license,
        imageIsExactPlace: true,
        imageConfidence: "high",
      };
    }
  }

  // 3. Google only when needed
  if (shouldUseGooglePremium(input, result)) {
    const query = `${input.name}, ${input.destination}`;

    const googleCandidate = await googleTextSearchPlace({
      query,
      lat: result.latitude,
      lon: result.longitude,
      includedType: isFoodCategory(category)
        ? category === "cafe"
          ? "cafe"
          : "restaurant"
        : undefined,
    });

    if (googleCandidate?.id) {
      const details = await googlePlaceDetails({
        placeId: googleCandidate.id,
        mode: isFoodCategory(category) ? "food_card" : "basic",
      });

      if (details) {
        result = {
          ...result,
          externalSource: "google_places",
          externalPlaceId: details.id,
          name: details.displayName?.text ?? result.name,
          latitude: details.location?.latitude ?? result.latitude,
          longitude: details.location?.longitude ?? result.longitude,
          rating: details.rating ?? null,
          reviewCount: details.userRatingCount ?? null,
          priceLevel: details.priceLevel ?? null,
          openingHours: {
            openNow: details.currentOpeningHours?.openNow,
            weekdayDescriptions:
              details.currentOpeningHours?.weekdayDescriptions ??
              details.regularOpeningHours?.weekdayDescriptions,
          },
          reviewSnippets:
            details.reviews?.slice(0, 3).map((r: any) => ({
              text: r.text?.text,
              rating: r.rating,
              authorName: r.authorAttribution?.displayName,
              relativeTime: r.relativePublishTimeDescription,
              source: "google",
            })) ?? [],
          enrichmentConfidence: "high",
        };

        const firstPhoto = details.photos?.[0];

        if (firstPhoto?.name && !result.imageUrl) {
          const photo = await googlePlacePhotoUrl({
            photoName: firstPhoto.name,
            maxWidthPx: 900,
          });

          if (photo?.url) {
            result = {
              ...result,
              imageUrl: photo.url,
              imageSource: "google_places",
              imageSourceUrl: photo.sourceUrl,
              imageAttribution:
                firstPhoto.authorAttributions
                  ?.map((a: any) => a.displayName)
                  .join(", ") ?? null,
              imageIsExactPlace: true,
              imageConfidence: "high",
            };
          }
        }
      }
    }
  }

  // 4. Generic fallback image
  if (!result.imageUrl) {
    const pexels = await findPexelsImage({
      query: isFoodCategory(category)
        ? `${category} ${input.destination}`
        : `${input.name} ${input.destination}`,
    });

    if (pexels) {
      result = {
        ...result,
        imageUrl: pexels.url,
        imageSource: "pexels",
        imageSourceUrl: pexels.sourceUrl,
        imageAttribution: pexels.attribution,
        imageAuthor: pexels.author,
        imageLicense: pexels.license,
        imageIsExactPlace: false,
        imageConfidence: "low",
      };
    }
  }

  await setCachedEnrichment(cacheKey, result, {
    ttlDays: result.externalSource === "google_places" ? 7 : 30,
  });

  return result;
}
```

---

## 12. Update `/api/places/generate-cards`

Current plan says the endpoint deduplicates itinerary items, enriches with OpenTripMap, batches every five places to Gemini, and inserts cards. Replace that with:

```txt
1. Load trip + itinerary_items.
2. Deduplicate place-like items.
3. For each item:
   - use AI category if already present
   - call enrichPlace()
   - attach image/rating/opening hours/review snippets
4. Batch enriched places into Gemini prompt.
5. Save place_cards with provider metadata.
```

Pseudo-code:

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await req.json();

  const trip = await getTripForUser(tripId, session.user.id);
  const items = await getItineraryItemsForTrip(tripId);

  const uniquePlaces = dedupePlaceItems(items);

  const enriched = [];

  for (const place of uniquePlaces) {
    const enrichment = await enrichPlace({
      name: place.title,
      destination: trip.destination,
      country: trip.country,
      category: place.category ?? inferCategoryFromItem(place),
      locationHint: place.location,
      lat: trip.latitude,
      lon: trip.longitude,
      cardPriority: place.type === "meal" ? "high" : "normal",
    });

    enriched.push({
      itineraryItemId: place.id,
      ...enrichment,
    });
  }

  const cards = await generatePlaceCardsWithGemini({
    trip,
    places: enriched,
  });

  await insertPlaceCards(tripId, cards, enriched);

  return Response.json({ cards });
}
```

---

## 13. Gemini prompt update

Do not let Gemini invent ratings/reviews. Tell it exactly what is grounded.

```txt
You are RouteCrafted, a precise travel place-card assistant.

Generate concise "worth it / skip it" cards.

Rules:
- Use provided external metadata only when present.
- Do not invent ratings, review counts, opening hours, cuisine, or review quotes.
- If rating/reviews are absent, do not mention public reviews.
- If imageIsExactPlace is false, do not imply the image is the real venue.
- If metadata confidence is low, keep claims general.
- For restaurants and cafés, prioritize practical decision factors:
  food/cuisine fit, likely crowding, price level, location convenience, timing, and traveler profile.
```

Per-place input:

```json
{
  "name": "Café Central",
  "category": "cafe",
  "destination": "Vienna",
  "rating": 4.4,
  "reviewCount": 21500,
  "priceLevel": "PRICE_LEVEL_MODERATE",
  "openingHours": {
    "openNow": true,
    "weekdayDescriptions": ["Monday: 8:00 AM – 10:00 PM"]
  },
  "reviewSnippets": [
    {
      "text": "Historic atmosphere and classic Viennese cakes...",
      "rating": 5,
      "source": "google"
    }
  ],
  "imageIsExactPlace": true,
  "imageSource": "google_places",
  "enrichmentConfidence": "high"
}
```

---

## 14. Cost-control rules

### Rule 1: Cache first

Before any provider call:

```txt
check DB cache
if cache hit and not expired → use it
```

### Rule 2: Google only once per place per trip

Store `externalPlaceId` and `externalSource`. If the place was already enriched from Google, do not call Text Search again.

### Rule 3: Details only after matching

Avoid:

```txt
Text Search → Details → Photo
```

for every item.

Prefer:

```txt
Free metadata → only if food/high-priority → Text Search → Details → maybe Photo
```

### Rule 4: Reviews are optional

Do not request `reviews` by default for every food place. Add a mode:

```ts
GOOGLE_PLACES_REVIEWS_ENABLED=false
```

Then you can enable reviews only for demo or selected cards.

### Rule 5: Field masks by use case

Use narrow field masks. Google's Places API New is explicitly field-mask driven, and fields are tied to different pricing tiers/SKUs.

---

## 15. Review handling policy

Use Google reviews as **supporting snippets**, not as your main content.

Display rules:

```txt
Show rating + review count if available.
Show max 1–3 review snippets.
Show "Powered by Google" / attribution as required by Google Maps Platform terms.
Do not rewrite review snippets as if they are your own user reviews.
Do not store or present them without respecting Google policies.
Do not scrape extra Google reviews.
```

Google's Places API policy page says reviews are represented as Review objects and are returned by including the review field in the request field mask; it also notes that default sorting is by relevance.

---

## 16. Suggested fallback order by place type

### Landmark / museum / park

```txt
1. AI category
2. Wikipedia/Wikidata image
3. Wikimedia Commons nearby image
4. Pexels/Unsplash generic image
5. Google only if high-priority and image missing
6. no image
```

### Restaurant / café / bar

```txt
1. AI category
2. Geoapify / OSM for coordinates + category
3. Google Places Text Search
4. Google Place Details for rating, opening hours, photos, reviews
5. Google Place Photo if available
6. Pexels fallback if Google unavailable or quota exceeded
7. no image
```

### Generic activity

```txt
1. AI category
2. Pexels/Unsplash generic image
3. no image
```

---

## 17. UI behavior

For exact image:

```tsx
<Image src={card.imageUrl} alt={card.name} />
<span>{card.imageAttribution}</span>
```

For generic image:

```tsx
<Image src={card.imageUrl} alt={`${card.category} in ${trip.destination}`} />
<span>Illustrative image · {card.imageSource}</span>
```

For reviews:

```tsx
{card.rating && (
  <div>
    ★ {card.rating} · {card.reviewCount} Google reviews
  </div>
)}

{card.reviewSnippets?.length > 0 && (
  <section>
    <h4>Review signal</h4>
    {card.reviewSnippets.slice(0, 2).map((review) => (
      <blockquote key={review.text}>{review.text}</blockquote>
    ))}
  </section>
)}
```

Important wording:

```txt
Good:
"Google rating signal"
"Review snippets from Google"
"Illustrative image"

Bad:
"Our users say..."
"Top rated by RouteCrafted"
"Real photo" when imageIsExactPlace=false
```

---

## 18. Updated ADR

```md
# ADR: Use Google Places as a minimum-usage premium fallback

## Status
Accepted

## Context
RouteCrafted generates itinerary items using AI and then creates mobile-first "worth it / skip it" cards. OpenTripMap was previously used as a POI enrichment layer, but it is not required for discovery. Category can be generated by the AI using a controlled enum. Images and restaurant/café trust signals remain the main enrichment gap.

## Decision
RouteCrafted will use a provider chain for place enrichment:
1. AI-generated category and existing cache
2. Geoapify / OSM for free POI metadata
3. Wikidata/Wikipedia/Wikimedia for exact landmark images
4. Pexels/Unsplash for generic fallback images
5. Google Places only for restaurants, cafés, bars, hotels, high-priority cards, or unresolved/ambiguous places

Google Places calls must go through a quota guard, use field masks, and be cached. Google reviews and photos are optional and must include source/attribution metadata.

## Consequences
This reduces API cost while improving card quality where it matters most. Restaurant and café cards become more trustworthy because they can include rating, review count, opening hours, and exact photos when Google is used. Landmark cards remain mostly free through Wikimedia sources.
```

---

## 19. Recommended final implementation order

1. Add `category` to AI itinerary item schema.
2. Add enrichment metadata columns to `place_cards`.
3. Add `place_enrichment_cache`.
4. Implement Pexels/Wikipedia image fallback.
5. Implement Geoapify/OSM metadata.
6. Implement Google quota table.
7. Implement Google Text Search + Place Details.
8. Add Google Place Photos only after details matching works.
9. Add Google reviews last, behind `GOOGLE_PLACES_REVIEWS_ENABLED`.
10. Add admin/debug screen showing enrichment source and confidence.

Final recommendation:

```txt
Use Google Places, but only as a premium fallback.
For restaurants/cafés: Google is justified.
For landmarks: Wikimedia is usually enough.
For generic card visuals: Pexels/Unsplash is enough.
For discovery: keep AI + Geoapify/OSM, not Google-first.
```
