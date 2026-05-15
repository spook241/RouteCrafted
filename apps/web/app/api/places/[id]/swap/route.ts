import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getPlaceCardById, insertPlaceCard, linkItemToCard, deletePlaceCard } from "@/lib/db/places";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { buildCardPayload } from "@/lib/places/card-generator";
import { db } from "@/lib/db";
import { itineraryItems, itineraryDays } from "@/lib/db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  // Verify card exists and belongs to the user
  const card = await getPlaceCardById(id);
  if (!card) return new NextResponse("Not Found", { status: 404 });

  const trip = await getTripById(card.tripId, session.user.id);
  if (!trip) return new NextResponse("Forbidden", { status: 403 });

  // Find the next unlinked activity item in this trip (ordered by day + position)
  const [nextItem] = await db
    .select({ item: itineraryItems, dayNumber: itineraryDays.dayNumber })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryDays.id, itineraryItems.dayId))
    .where(
      and(
        eq(itineraryDays.tripId, card.tripId),
        eq(itineraryItems.type, "activity"),
        isNull(itineraryItems.placeCardId),
      ),
    )
    .orderBy(asc(itineraryDays.dayNumber), asc(itineraryItems.position))
    .limit(1);

  if (!nextItem) {
    return NextResponse.json(
      { error: "No more activities to swap in" },
      { status: 409 },
    );
  }

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

  const payload = await buildCardPayload(
    {
      id: nextItem.item.id,
      title: nextItem.item.title,
      category: nextItem.item.category,
      location: nextItem.item.location,
    },
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
    true, // bypassCache — always fetch fresh data for a swap
  );

  if (!payload)
    return NextResponse.json(
      { error: "Failed to generate card for next activity" },
      { status: 502 },
    );

  const newCard = await insertPlaceCard({ ...payload, tripId: card.tripId });
  await linkItemToCard(nextItem.item.id, newCard.id);

  // Remove the old card (nulls item reference internally)
  await deletePlaceCard(id);

  return NextResponse.json({ card: newCard });
}
