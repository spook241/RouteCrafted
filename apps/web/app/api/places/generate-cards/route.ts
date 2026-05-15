import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getDaysByTrip } from "@/lib/db/itinerary";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import {
  insertPlaceCard,
  linkItemToCard,
  deleteAllPlaceCardsByTrip,
} from "@/lib/db/places";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { buildCardPayload } from "@/lib/places/card-generator";

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

  // Replace-all semantics: delete existing cards first
  await deleteAllPlaceCardsByTrip(tripId);

  // Get all activity items across the trip
  const allItems = await db
    .select()
    .from(itineraryItems)
    .where(inArray(itineraryItems.dayId, dayIds));

  const candidates = allItems
    .filter((item) => item.type === "activity")
    .slice(0, MAX_CARDS);

  if (candidates.length === 0) {
    return NextResponse.json({ generated: 0, cards: [] });
  }

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
    const payload = await buildCardPayload(
      { id: item.id, title: item.title, category: item.category, location: item.location },
      {
        destination: trip.destination,
        country: trip.country,
        lat: trip.lat,
        long: trip.long,
        travelStyle: trip.travelStyle,
        groupType: trip.groupType,
        budgetRange: trip.budgetRange,
      },
      promptRow.template,
      model,
    );

    if (!payload) continue;

    try {
      const card = await insertPlaceCard({ ...payload, tripId });
      await linkItemToCard(item.id, card.id);
      generated.push(card);
    } catch {
      continue;
    }
  }

  return NextResponse.json({ generated: generated.length, cards: generated });
}
