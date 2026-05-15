import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getTripById, updateTrip } from "@/lib/db/trips";
import { getDaysByTrip, insertDays, insertItems } from "@/lib/db/itinerary";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { itineraryResponseSchema } from "@/lib/ai/schemas";

const bodySchema = z.object({
  tripId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { tripId } = parsed.data;
  const trip = await getTripById(tripId, session.user.id);
  if (!trip) return new NextResponse("Not Found", { status: 404 });

  const existing = await getDaysByTrip(tripId);
  if (existing.length > 0)
    return NextResponse.json(
      { error: "Itinerary already generated — use rewrite-day to update individual days" },
      { status: 409 },
    );

  const startMs = new Date(trip.startDate).getTime();
  const endMs = new Date(trip.endDate).getTime();
  const totalDays = Math.round((endMs - startMs) / 86_400_000) + 1;

  // Fetch prompt template + model from DB
  const [promptRow, settings] = await Promise.all([
    getActivePrompt("generate_itinerary"),
    getAllSettings(),
  ]);
  const model = settings.find((s) => s.key === "model")?.value;

  if (!promptRow)
    return NextResponse.json(
      { error: "No active prompt found for generate_itinerary" },
      { status: 503 },
    );

  const prompt = interpolate(promptRow.template, {
    destination: trip.destination,
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalDays: String(totalDays),
    budgetRange: trip.budgetRange,
    travelStyle: trip.travelStyle,
    groupType: trip.groupType,
    pacing: trip.pacing,
  });

  let rawResponse: unknown;
  try {
    rawResponse = await generateJSON<unknown>(prompt, model);
  } catch {
    return NextResponse.json(
      { error: "AI generation failed — check OPENROUTER_API_KEY" },
      { status: 502 },
    );
  }

  // AI may wrap the array in a { days: [...] } object — unwrap if so
  const candidate =
    Array.isArray(rawResponse)
      ? rawResponse
      : (rawResponse as Record<string, unknown>)?.days ?? rawResponse;

  const validated = itineraryResponseSchema.safeParse(candidate);
  if (!validated.success)
    return NextResponse.json(
      { error: "AI returned invalid structure", details: validated.error.issues },
      { status: 422 },
    );

  const days = validated.data;

  // Bulk insert days
  const insertedDays = await insertDays(
    days.map((d) => ({
      tripId,
      dayNumber: d.dayNumber,
      date: d.date,
      theme: d.theme,
      summary: d.summary,
    })),
  );

  // Map dayNumber → inserted id
  const dayIdMap = new Map(insertedDays.map((d) => [d.dayNumber, d.id]));

  // Bulk insert all items
  const itemRows = days.flatMap((d) =>
    d.items.map((item, idx) => ({
      dayId: dayIdMap.get(d.dayNumber)!,
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
    })),
  );

  await insertItems(itemRows);

  // Activate trip
  await updateTrip(tripId, session.user.id, { status: "active" });

  return NextResponse.json({ days: insertedDays }, { status: 201 });
}
