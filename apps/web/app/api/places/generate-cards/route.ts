import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getDaysByTrip } from "@/lib/db/itinerary";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/db/schema";
import { eq, isNull, inArray } from "drizzle-orm";
import {
  insertPlaceCard,
  linkItemToCard,
  getAllPlaceCardsByTrip,
} from "@/lib/db/places";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { placeCardResponseSchema, type PlaceCardResponse } from "@/lib/ai/schemas";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { resolveEnrichment } from "@/lib/places/resolver";

const bodySchema = z.object({
  tripId: z.string().uuid(),
});

const MAX_CARDS = 8;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { tripId } = parsed.data;

  const trip = await getTripById(tripId, session.user.id);
  if (!trip) return new NextResponse("Not Found", { status: 404 });

  // Get all days for this trip
  const days = await getDaysByTrip(tripId);
  if (days.length === 0)
    return NextResponse.json(
      { error: "Generate an itinerary first" },
      { status: 409 },
    );

  const dayIds = days.map((d) => d.id);

  // Get activity items that don't have a place card yet
  const allItems = await db
    .select()
    .from(itineraryItems)
    .where(
      inArray(itineraryItems.dayId, dayIds),
    );

  const candidates = allItems
    .filter((item) => item.type === "activity" && item.placeCardId === null)
    .slice(0, MAX_CARDS);

  if (candidates.length === 0) {
    // All items already have cards — return existing
    const existing = await getAllPlaceCardsByTrip(tripId);
    return NextResponse.json({ generated: 0, cards: existing });
  }

  const tripLat = trip.lat ? parseFloat(trip.lat) : null;
  const tripLon = trip.long ? parseFloat(trip.long) : null;

  // Fetch prompt template + model from DB (once, before the loop)
  const [promptRow, settings] = await Promise.all([
    getActivePrompt("place_card"),
    getAllSettings(),
  ]);

  if (!promptRow)
    return NextResponse.json(
      { error: "No active prompt found for place_card" },
      { status: 503 },
    );

  const model = settings.find((s) => s.key === "model")?.value;

  const generated: Awaited<ReturnType<typeof insertPlaceCard>>[] = [];

  for (const item of candidates) {
    try {
      // Resolve enrichment via layered provider chain
      const enrichment = await resolveEnrichment({
        name: item.title,
        destination: trip.destination,
        lat: tripLat ?? 0,
        lon: tripLon ?? 0,
        category: item.category ?? undefined,
      });

      const category = enrichment.category ?? item.category ?? "attraction";

      const prompt = interpolate(promptRow.template, {
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

      const card = await insertPlaceCard({
        tripId,
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
        // enrichment metadata
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
      });

      await linkItemToCard(item.id, card.id);
      generated.push(card);
    } catch {
      // Skip failed individual card — don't abort the whole batch
      continue;
    }
  }

  return NextResponse.json({ generated: generated.length, cards: generated });
}
