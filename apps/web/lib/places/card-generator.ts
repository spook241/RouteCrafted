// Shared helper: build a PlaceCardInsert payload for a single activity item.
// Used by both generate-cards (batch) and the swap endpoint (single).

import { resolveEnrichment } from "./resolver";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { placeCardResponseSchema, type PlaceCardResponse } from "@/lib/ai/schemas";
import type { PlaceCardInsert } from "@/lib/db/places";

export type TripContext = {
  destination: string;
  country: string;
  lat: string | null;
  long: string | null;
  travelStyle: string;
  groupType: string;
  budgetRange: string;
};

export type ItemContext = {
  id: string;
  title: string;
  category: string | null;
  location: string;
};

/**
 * Build a complete PlaceCardInsert payload (minus `tripId`) for a single item.
 * Returns null if enrichment or AI generation fails.
 */
export async function buildCardPayload(
  item: ItemContext,
  trip: TripContext,
  promptTemplate: string,
  model?: string,
  bypassCache = false,
): Promise<Omit<PlaceCardInsert, "tripId"> | null> {
  try {
    const tripLat = trip.lat ? parseFloat(trip.lat) : 0;
    const tripLon = trip.long ? parseFloat(trip.long) : 0;

    const enrichment = await resolveEnrichment({
      name: item.title,
      destination: trip.destination,
      lat: tripLat,
      lon: tripLon,
      category: item.category ?? undefined,
      bypassCache,
    });

    const category = enrichment.category ?? item.category ?? "attraction";

    const prompt = interpolate(promptTemplate, {
      name: item.title,
      category,
      location: item.location,
      destination: trip.destination,
      country: trip.country,
      travelStyle: trip.travelStyle,
      groupType: trip.groupType,
      budgetRange: trip.budgetRange,
    });

    const raw = await generateJSON<PlaceCardResponse>(prompt, model);
    const validated = placeCardResponseSchema.parse(raw);

    return {
      name: item.title,
      category,
      verdict: validated.verdict,
      summary: validated.summary,
      worthItReasons: validated.worthItReasons,
      skipItReasons: validated.skipItReasons,
      bestFor: validated.bestFor,
      costLevel: validated.costLevel,
      timeNeeded: validated.timeNeeded,
      lat: enrichment.lat != null ? String(enrichment.lat) : null,
      long: enrichment.lon != null ? String(enrichment.lon) : null,
      imageUrl: enrichment.imageUrl ?? null,
      rating: enrichment.rating != null ? String(enrichment.rating) : null,
      reviewCount: enrichment.reviewCount ?? null,
      priceLevel: enrichment.priceLevel ?? null,
      openingHours: enrichment.openingHours ?? null,
      imageSource: enrichment.source,
      imageAttribution: enrichment.imageAttribution ?? null,
      imageIsExact: enrichment.imageIsExact,
      enrichmentConfidence: String(enrichment.confidence),
      externalSource: enrichment.source,
      externalPlaceId: enrichment.providerId ?? null,
      enrichedAt: new Date(),
    };
  } catch {
    return null;
  }
}
