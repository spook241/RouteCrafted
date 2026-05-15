import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTripById, updateTrip } from "@/lib/db/trips";
import { fetchCityPhoto } from "@/lib/places/city-photo";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trip = await getTripById(id, session.user.id);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photo = await fetchCityPhoto(trip.destination, trip.country, trip.lat, trip.long);
  if (!photo) return NextResponse.json({ error: "No photo found" }, { status: 404 });

  await updateTrip(id, session.user.id, { coverImageUrl: photo.imageUrl });
  return NextResponse.json({ coverImageUrl: photo.imageUrl });
}
