import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteTrip, getTripById, updateTrip } from "@/lib/db/trips";
import { getDaysByTrip } from "@/lib/db/itinerary";

const updateTripSchema = z
  .object({
    destination: z.string().min(1),
    country: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    budgetRange: z.enum(["budget", "mid", "luxury"]),
    travelStyle: z.enum(["cultural", "adventure", "relaxation", "foodie"]),
    groupType: z.enum(["solo", "couple", "family", "friends"]),
    pacing: z.enum(["relaxed", "moderate", "packed"]),
    status: z.enum(["draft", "active", "completed"]),
    rating: z.number().int().min(1).max(5).nullable(),
    comment: z.string().max(500).nullable(),
    itineraryStale: z.boolean(),
  })
  .partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await getTripById(id, session.user.id);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(trip);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await getTripById(id, session.user.id);
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Completed trips: only rating and comment can be updated
  if (trip.status === "completed") {
    const { rating, comment } = parsed.data;
    const updated = await updateTrip(id, session.user.id, { rating: rating ?? null, comment: comment ?? null });
    return NextResponse.json(updated);
  }

  const updateData = { ...parsed.data };

  // Auto-set itineraryStale when preference fields change and an itinerary exists
  const prefFields = ["budgetRange", "travelStyle", "groupType", "pacing"] as const;
  const prefsChanged = prefFields.some(
    (k) => k in parsed.data && parsed.data[k] !== trip[k],
  );
  if (prefsChanged && updateData.itineraryStale === undefined) {
    const days = await getDaysByTrip(id);
    if (days.length > 0) {
      updateData.itineraryStale = true;
    }
  }

  const updated = await updateTrip(id, session.user.id, updateData);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteTrip(id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
