Yes — the correct implementation is **not “replace Mapbox.”** It is:

> **Keep Mapbox exactly for destination autocomplete and trip coordinates. Add a separate place-card enrichment pipeline that uses Google only when the existing/free sources are not enough.**

Your current RouteCrafted plan already uses **Mapbox for client-side destination autocomplete**, **Nominatim for server-side geocoding**, and **OpenTripMap for POI enrichment**.  The Create Trip screen specifically starts with “Destination search (Mapbox autocomplete),” then dates, budget, travel style, group type, and pacing.  So Mapbox stays in the trip creation flow.

# Technical implementation description

## 1. Keep the existing Mapbox flow unchanged

Mapbox remains responsible for the **user-facing destination selection**.

Current flow should stay:

```txt
Create Trip screen
→ user types destination
→ Mapbox autocomplete suggestions
→ user selects destination
→ app stores destination name + coordinates
→ trip is created
→ itinerary generation uses those coordinates
```

Mapbox Search JS is designed for interactive location search in the browser and can retrieve suggestion coordinates programmatically. ([Mapbox][1]) The Mapbox Search Box API uses a two-step flow where `/suggest` returns suggestions and `/retrieve` returns coordinates for the selected result. ([Mapbox][2])

So Mapbox should remain the source for:

| Area                                   | Provider      |
| -------------------------------------- | ------------- |
| Destination autocomplete               | **Mapbox**    |
| User-selected trip coordinates         | **Mapbox**    |
| Create Trip UX                         | **Mapbox**    |
| Server fallback if coordinates missing | **Nominatim** |

Do **not** add Google Places Autocomplete. That would duplicate Mapbox, increase cost, and blur provider responsibilities.

---

## 2. Move Google to a separate enrichment layer

Google should be added **after itinerary generation**, not during destination search.

Correct system boundary:

```txt
Trip creation = Mapbox
Itinerary generation = Gemini
Place-card enrichment = provider chain
```

The place-card enrichment layer runs when `/api/places/generate-cards` is called. Your current technical plan already has this endpoint for generating “worth it / skip it” cards, and the business documentation positions cards as fast mobile decision summaries for attractions, restaurants, neighborhoods, and activities.  

New enrichment flow:

```txt
Load itinerary items
→ deduplicate place names
→ use AI-generated category
→ check local cache
→ enrich from free/open providers
→ call Google only if needed
→ generate final card summary
→ save place_card
```

---

## 3. Replace OpenTripMap with a provider chain, not one provider

OpenTripMap currently sits in your docs as the POI enrichment provider.  Replace that single dependency with a layered resolver:

```txt
1. Existing DB/cache
2. AI-generated category
3. Geoapify / OSM metadata
4. Wikimedia/Wikipedia/Wikidata for landmark images
5. Pexels/Unsplash for generic images
6. Google Places only for selected high-value cases
7. no image / no review fallback
```

Geoapify is suitable for free/open POI metadata because its Places API queries points of interest using OpenStreetMap data and supports hundreds of categories. ([Geoapify API Docs][3]) Its public product page also describes querying restaurants, tourist attractions, historical objects and accommodation by category. ([Geoapify][4])

Use Geoapify/OSM for:

```txt
category confirmation
coordinates
cuisine
opening-hours if available
website/contact if available
basic POI identity
```

Use Wikimedia/Wikipedia for:

```txt
museum images
landmark images
historic building images
monument images
famous park images
```

Use Pexels/Unsplash for:

```txt
generic café image
generic restaurant image
generic destination image
generic activity image
```

Use Google Places only for:

```txt
restaurant
café
bar
bakery
hotel
high-priority card with missing image
ambiguous place match
card where rating/reviews/opening hours are important
```

---

## 4. Define provider responsibility clearly

| Function                 | Main provider              | Fallback                | Google role          |
| ------------------------ | -------------------------- | ----------------------- | -------------------- |
| Destination autocomplete | **Mapbox**                 | None / manual           | **Do not use**       |
| Trip coordinates         | **Mapbox selected result** | Nominatim               | Rarely, avoid        |
| Itinerary generation     | Gemini                     | —                       | Do not use           |
| Category                 | AI schema                  | Geoapify/OSM            | Rarely               |
| Landmark image           | Wikimedia/Wikipedia        | Pexels/Unsplash         | Rarely               |
| Restaurant/café metadata | Geoapify/OSM               | Google                  | Use when needed      |
| Restaurant/café rating   | None/free unavailable      | Google                  | Use selectively      |
| Reviews                  | None by default            | Google snippets         | Use only behind flag |
| Exact venue photo        | Google                     | Pexels/Unsplash generic | Use selectively      |
| Generic image            | Pexels/Unsplash            | no image                | Do not use           |

Google Place Details can return more comprehensive information such as complete address, phone number, user rating and reviews once you have a place ID. ([Google for Developers][5]) Google Place Photos then uses the photo resource name from Place Details and returns a `photoUri` for displaying the photo. ([Google for Developers][6])

---

## 5. Add enrichment status to your data model

Your existing `place_cards` table has useful basics: name, category, verdict, summary, reasons, cost level, time needed, latitude, longitude, and `imageUrl`.  That is not enough once you mix Wikimedia, Pexels, Unsplash, Geoapify and Google.

Add metadata fields conceptually for:

```txt
externalSource
externalPlaceId
rating
reviewCount
priceLevel
openingHours
reviewSnippets
imageSource
imageAttribution
imageAuthor
imageLicense
imageSourceUrl
imageIsExactPlace
imageConfidence
enrichmentConfidence
enrichedAt
```

Why this matters:

```txt
A Google photo is an exact venue photo.
A Wikimedia image is often an exact landmark photo.
A Pexels image is usually illustrative only.
```

The UI must know the difference.

For example:

```txt
Exact image:
“Photo: Google / Wikimedia”

Generic image:
“Illustrative image: Pexels”
```

This prevents the app from misleading users.

---

## 6. Add a place-enrichment cache

This is critical if you add Google.

Create a separate cache concept for enriched places:

```txt
place_enrichment_cache
```

It should store:

```txt
normalized place name
destination
category
provider
provider place ID
coordinates
rating/review metadata
image metadata
raw provider payload if needed
createdAt
expiresAt
```

Cache strategy:

| Data type                           |                     Suggested TTL |
| ----------------------------------- | --------------------------------: |
| Landmark image from Wikimedia       |                        30–90 days |
| Geoapify/OSM metadata               |                        14–30 days |
| Pexels/Unsplash fallback image      |                           30 days |
| Google rating/opening hours/reviews |                         7–14 days |
| Google photo reference/name         |                         7–30 days |
| Google rendered photo URL           | short-lived / refresh when needed |

The goal is simple: **do not pay twice for the same restaurant/café card unless the cached data is stale.**

---

## 7. Add Google usage controls

Google must not be called directly from the card generator. Put it behind a usage policy.

Minimum controls:

```txt
GOOGLE_PLACES_ENABLED
GOOGLE_PLACES_ONLY_FOR_FOOD
GOOGLE_PLACES_PHOTOS_ENABLED
GOOGLE_PLACES_REVIEWS_ENABLED
GOOGLE_PLACES_DAILY_LIMIT
GOOGLE_PLACES_MONTHLY_LIMIT
```

Operational rule:

```txt
Every Google request must pass:
1. feature flag check
2. category check
3. cache check
4. daily/monthly quota check
5. field-mask minimization
```

Google’s Places API New requires field masks, and its documentation says place data fields are organized by pricing tier; requests must specify at least one field in the field mask. ([Google for Developers][7]) That is good for your use case because you can request cheap identity fields first, then request richer review/photo/opening-hour fields only for food venues.

---

## 8. Use two Google modes

Do not use one heavy Google request for everything.

### Mode A — basic identity resolution

Use only when a place match is ambiguous or missing coordinates.

Fields conceptually:

```txt
place ID
display name
formatted address
coordinates
types
primary type
```

Use case:

```txt
“Is this itinerary item a real place?”
“Which exact place is this restaurant?”
“Do I have the correct coordinates?”
```

### Mode B — food/card enrichment

Use only for restaurants, cafés, bars, bakeries, hotels.

Fields conceptually:

```txt
rating
review count
price level
opening hours
photos
short review snippets
website
phone
```

Use case:

```txt
“This place card needs a real venue photo, rating, opening hours, and review signal.”
```

This keeps cost under control.

---

## 9. Update the AI itinerary schema

Instead of relying on OpenTripMap to classify places after the fact, make the AI return a controlled category for every itinerary item.

Add conceptual fields to itinerary items:

```txt
category
placeType
isPlaceCardCandidate
locationHint
```

For example:

```txt
title: “Café Central”
type: “meal”
category: “cafe”
locationHint: “Vienna city center”
isPlaceCardCandidate: true
```

Recommended category enum:

```txt
museum
landmark
historic
park
nature
restaurant
cafe
bar
bakery
hotel
neighborhood
shopping
beach
viewpoint
activity
attraction
transport
```

This removes one of OpenTripMap’s current roles: category cleanup.

---

## 10. Update `/api/places/generate-cards` behavior

Do not think of this endpoint as “call OpenTripMap, then Gemini.”

New behavior:

```txt
/api/places/generate-cards
```

Should do:

```txt
1. Load trip.
2. Load itinerary items.
3. Deduplicate place-like items.
4. For each place:
   - read AI category
   - check cache
   - enrich with free/open providers
   - conditionally enrich with Google
   - attach image/review/rating/opening-hour metadata
5. Send grounded data to Gemini.
6. Generate worth-it / skip-it card text.
7. Save place card + enrichment metadata.
```

This aligns better with your business requirement: quick mobile decision cards, not a full POI database. 

---

## 11. Add a confidence model

Every enriched card should have a confidence level.

Recommended values:

```txt
high
medium
low
```

Examples:

| Case                                               | Confidence |
| -------------------------------------------------- | ---------- |
| Google place matched by exact name + address       | High       |
| Wikimedia image from exact Wikipedia/Wikidata page | High       |
| Geoapify POI matched by name + nearby coordinates  | Medium     |
| Pexels image by category/destination               | Low        |
| AI-only category with no external metadata         | Low        |

Use confidence in the prompt:

```txt
If confidence is low, write generic wording.
If rating is absent, do not mention reviews.
If image is generic, do not imply it is the real place.
```

This is important because your business doc already identifies hallucinated or stale recommendations as a product risk. 

---

## 12. UI changes

### Place card image behavior

The card component should support three states:

```txt
1. Exact image
2. Illustrative/generic image
3. No image
```

Display labels:

```txt
Exact image:
“Photo source: Google / Wikimedia”

Generic image:
“Illustrative image”

No image:
Use category icon or gradient placeholder
```

### Restaurant/café card behavior

For food places, show richer metadata only when available:

```txt
rating
review count
price level
open now / opening hours
short review signal
website / phone optional
```

Do not show empty labels.

Bad:

```txt
Rating: N/A
Reviews: N/A
```

Good:

```txt
Show rating block only if rating exists.
Show review signal only if real review snippets exist.
```

### Review wording

Use:

```txt
“Google review signal”
“Review snippets from Google”
“Rating from Google”
```

Do not use:

```txt
“Our users say”
“RouteCrafted rating”
“People say” without source
```

---

## 13. Admin/debug visibility

Add admin visibility for enrichment quality.

In the admin panel or internal debug view, show:

```txt
place name
category
enrichment source
image source
image confidence
external provider ID
rating/review source
last enriched date
flag status
```

Your current plan already includes admin moderation for content flags and place-card review.  Extend that concept to include enrichment quality so you can debug bad images or wrong place matches.

---

# Final implementation roadmap

## Phase 1 — Preserve existing Mapbox and stabilize trip coordinates

Keep the Create Trip Mapbox autocomplete exactly as it is. Ensure the selected destination stores:

```txt
destination name
country/region if available
latitude
longitude
mapbox provider ID if available
provider = mapbox
```

Nominatim remains only a backend fallback when coordinates are missing. Your integration guide already recommends Mapbox for client-side autocomplete and Nominatim for server-side coordinate resolution. 

## Phase 2 — Remove OpenTripMap from critical logic

Stop treating OpenTripMap as required. Replace it with:

```txt
AI category
Geoapify/OSM optional metadata
image resolver
Google fallback
```

## Phase 3 — Add enrichment metadata to DB

Extend `place_cards` and add `place_enrichment_cache`.

This makes the system traceable, cheaper, and easier to debug.

## Phase 4 — Implement free image/data providers first

Add:

```txt
Wikimedia/Wikipedia for landmarks
Pexels or Unsplash for generic fallback images
Geoapify for POI metadata
```

## Phase 5 — Add Google with strict conditions

Enable Google only for:

```txt
restaurant
cafe
bar
bakery
hotel
high-priority missing image
ambiguous place
```

Use field masks and feature flags.

## Phase 6 — Add review snippets last

Start with:

```txt
GOOGLE_PLACES_REVIEWS_ENABLED=false
```

Then enable only when you are ready to display attribution and source wording correctly.

---

# Correct final architecture

```txt
Create Trip
  → Mapbox autocomplete
  → store selected destination + coordinates

Trip Creation API
  → use Mapbox coordinates
  → Nominatim fallback only if missing

Itinerary Generation
  → Gemini
  → returns structured itinerary items + category

Place Card Generation
  → deduplicate itinerary places
  → cache lookup
  → Geoapify/OSM metadata
  → Wikimedia/Wikipedia landmark images
  → Pexels/Unsplash generic images
  → Google Places only for food/hotel/high-value gaps
  → Gemini generates grounded “worth it / skip it” card

UI
  → show exact/generic/no-image state
  → show ratings/reviews only with real source
  → show provider attribution where needed
```

## Bottom line

Do it like this:

```txt
Mapbox = destination search UX
Nominatim = coordinate fallback
Gemini = itinerary and card text
Geoapify/OSM = cheap POI metadata
Wikimedia = real landmark images
Pexels/Unsplash = generic visual fallback
Google Places = minimum-usage premium enrichment for restaurants/cafés/bars/hotels
```

That keeps your current app architecture intact and adds Google only where it adds clear value.

[1]: https://docs.mapbox.com/mapbox-search-js/guides/?utm_source=chatgpt.com "Mapbox Search JS Core Framework"
[2]: https://docs.mapbox.com/api/search/search-box/?utm_source=chatgpt.com "Search Box API | API Docs"
[3]: https://apidocs.geoapify.com/docs/places/?utm_source=chatgpt.com "Places API | Developer Documentation"
[4]: https://www.geoapify.com/places-api/?utm_source=chatgpt.com "Places API - Points of Interest Data & Location Search"
[5]: https://developers.google.com/maps/documentation/places/web-service/place-details?utm_source=chatgpt.com "Place Details (New) | Places API"
[6]: https://developers.google.com/maps/documentation/places/web-service/place-photos?utm_source=chatgpt.com "Place Photos (New) | Places API"
[7]: https://developers.google.com/maps/documentation/places/web-service/data-fields?utm_source=chatgpt.com "Place Data Fields (New) | Places API"
