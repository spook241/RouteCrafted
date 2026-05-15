import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTripById, updateTrip } from "@/lib/db/trips";
import { clearItinerary } from "@/lib/db/itinerary";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await getTripById(id, session.user.id);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deleted = await clearItinerary(id, session.user.id);
  // Reset stale flag since itinerary is now cleared
  await updateTrip(id, session.user.id, { itineraryStale: false });

  return NextResponse.json({ deleted });
}
