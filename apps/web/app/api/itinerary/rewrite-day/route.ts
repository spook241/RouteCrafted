import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import {
  getDaysByTrip,
  deleteDayItems,
  insertItems,
  updateDay,
} from "@/lib/db/itinerary";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { rewriteDayResponseSchema } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { itineraryItems, placeCards } from "@/lib/db/schema";
import { insertPlaceCard, linkItemToCard } from "@/lib/db/places";
import { buildCardPayload } from "@/lib/places/card-generator";

const bodySchema = z.object({
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
  forecastCode: z.number().int().optional(),
  weatherLabel: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { tripId, dayId, forecastCode, weatherLabel, reason } = parsed.data;

  const trip = await getTripById(tripId, session.user.id);
  if (!trip) return new NextResponse("Not Found", { status: 404 });

  const days = await getDaysByTrip(tripId);
  const day = days.find((d) => d.id === dayId);
  if (!day) return new NextResponse("Day Not Found", { status: 404 });

  // Fetch prompt template + settings from DB
  const [promptRow, settings] = await Promise.all([
    getActivePrompt("rewrite_day"),
    getAllSettings(),
  ]);
  if (!promptRow)
    return NextResponse.json(
      { error: "No active prompt found for rewrite_day" },
      { status: 503 },
    );

  const model = settings.find((s) => s.key === "model")?.value;
  const provider = settings.find((s) => s.key === "provider")?.value ?? "openrouter";
  const weatherContextTpl =
    settings.find((s) => s.key === "rewrite_day_weather_context")?.value ?? "";
  const reasonContextTpl =
    settings.find((s) => s.key === "rewrite_day_reason_context")?.value ?? "";

  // Build the weatherContext block from configurable templates
  const weatherContext = weatherLabel
    ? interpolate(weatherContextTpl, {
        weatherLabel,
        forecastCode: String(forecastCode ?? ""),
      })
    : reason
    ? interpolate(reasonContextTpl, { reason })
    : "";

  const prompt = interpolate(promptRow.template, {
    destination: trip.destination,
    country: trip.country,
    dayNumber: String(day.dayNumber),
    date: day.date,
    theme: day.theme,
    summary: day.summary,
    budgetRange: trip.budgetRange,
    travelStyle: trip.travelStyle,
    groupType: trip.groupType,
    pacing: trip.pacing,
    weatherContext,
  });

  let rawResponse: unknown;
  try {
    rawResponse = await generateJSON<unknown>(prompt, model, {
      callType: "rewrite_day",
      tripId,
      dayId,
      userId: session.user.id,
    }, 60_000, provider);
  } catch (err) {
    console.error("[rewrite-day] generateJSON failed:", err);
    return NextResponse.json(
      { error: "AI generation failed — check your API key in .env.local" },
      { status: 502 },
    );
  }

  const validated = rewriteDayResponseSchema.safeParse(rawResponse);
  if (!validated.success)
    return NextResponse.json(
      { error: "AI returned invalid structure", details: validated.error.issues },
      { status: 422 },
    );

  const newDay = validated.data;

  // Delete place cards that were linked to this day's items (prevent orphans)
  const oldItems = await db
    .select({ placeCardId: itineraryItems.placeCardId })
    .from(itineraryItems)
    .where(eq(itineraryItems.dayId, dayId));
  const orphanCardIds = oldItems
    .map((i) => i.placeCardId)
    .filter((id): id is string => id != null);
  if (orphanCardIds.length > 0) {
    await db.delete(placeCards).where(inArray(placeCards.id, orphanCardIds));
  }

  await deleteDayItems(dayId);
  const newItems = await insertItems(
    newDay.items.map((item, idx) => ({
      dayId,
      position: idx + 1,
      timeBlock: item.timeBlock,
      type: item.type,
      category: item.category ?? null,
      title: item.title,
      description: item.description,
      location: item.location,
      durationMins: item.durationMins,
      estimatedCost: String(item.estimatedCost),
      isOptional: item.isOptional,
      tips: item.tips ?? null,
      bookingRequired: item.bookingRequired ?? false,
    })),
  );

  const updatedDay = await updateDay(dayId, {
    theme: newDay.theme,
    summary: newDay.summary,
    rewrittenAt: new Date(),
    ...(weatherLabel !== undefined && { weatherLabel }),
    ...(forecastCode !== undefined && { weatherCode: forecastCode }),
  });

  // Auto-generate place cards for the new items (parallel)
  const cardPromptRow = await getActivePrompt("place_card");
  if (cardPromptRow) {
    const cardModel =
      settings.find((s) => s.key === "model_place_card")?.value ??
      settings.find((s) => s.key === "model")?.value;
    const cardProvider = settings.find((s) => s.key === "provider")?.value ?? "openrouter";
    const cardCandidates = newItems.filter(
      (i) => i.type === "activity" || i.type === "meal",
    );
    const tripCtx = {
      destination: trip.destination,
      country: trip.country,
      lat: trip.lat,
      long: trip.long,
      travelStyle: trip.travelStyle,
      groupType: trip.groupType,
      budgetRange: trip.budgetRange,
      id: tripId,
    };
    await Promise.allSettled(
      cardCandidates.map(async (item) => {
        const payload = await buildCardPayload(
          { id: item.id, title: item.title, category: item.category, location: item.location },
          tripCtx,
          cardPromptRow.template,
          cardModel,
          false,
          session.user.id,
          cardProvider,
        );
        if (!payload || payload.verdict !== "worth_it") return;
        const card = await insertPlaceCard({ ...payload, tripId });
        await linkItemToCard(item.id, card.id);
      }),
    );
  }

  return NextResponse.json({ day: updatedDay });
}
