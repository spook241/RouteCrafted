export const maxDuration = 300;

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getTripById, updateTrip } from "@/lib/db/trips";
import { getDaysByTrip, insertDays, insertItems } from "@/lib/db/itinerary";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { itineraryResponseSchema } from "@/lib/ai/schemas";
import { insertPlaceCard, linkItemToCard } from "@/lib/db/places";
import { buildCardPayload } from "@/lib/places/card-generator";

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

  // Pre-flight checks passed — open SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  function send(data: object): void {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => undefined);
  }

  // Run generation in a detached async block; return the stream immediately
  (async () => {
    try {
      const startMs = new Date(trip.startDate).getTime();
      const endMs = new Date(trip.endDate).getTime();
      const totalDays = Math.round((endMs - startMs) / 86_400_000) + 1;

      // ── Step 1: profile — read prompt + settings ───────────────
      const [promptRow, settings] = await Promise.all([
        getActivePrompt("generate_itinerary"),
        getAllSettings(),
      ]);

      if (!promptRow) {
        send({ type: "error", message: "Something went wrong — please try again in a few minutes." });
        return;
      }

      const provider = settings.find((s) => s.key === "provider")?.value ?? "openrouter";
      const model = settings.find((s) => s.key === "model")?.value;
      const fastModel = settings.find((s) => s.key === "model_place_card")?.value ?? model;

      send({ type: "step", step: "profile", status: "done" });

      // ── Tips — fire-and-forget parallel call ────────────────────
      const tipsPrompt =
        `You are a travel expert. Return a JSON array of exactly 6 short travel tips.` +
        ` Trip: ${trip.destination}, ${trip.country}.` +
        ` Style: ${trip.travelStyle} | Group: ${trip.groupType} | Budget: ${trip.budgetRange} | Pace: ${trip.pacing}.` +
        ` Rules: one sentence each, maximum 15 words, specific to this destination and trip type, no generic clichés.` +
        ` Return ONLY the JSON array — no markdown, no explanation.`;

      generateJSON<unknown>(tipsPrompt, fastModel, { callType: "generate_tips", tripId, userId: session.user.id }, 15_000, provider)
        .then((raw) => {
          const parsed = z.array(z.string().min(1)).min(4).max(8).safeParse(raw);
          if (parsed.success) send({ type: "tips", tips: parsed.data });
        })
        .catch(() => undefined);

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
        userNotes: trip.userNotes
          ? `Traveller's special requests (treat as hard constraints — must be honoured):\n${trip.userNotes}`
          : "",
      });

      // ── Step 2: ai — call the model ─────────────────────────────
      send({ type: "step", step: "ai", status: "active" });

      let rawResponse: unknown;
      try {
        rawResponse = await generateJSON<unknown>(prompt, model, {
          callType: "generate_itinerary",
          tripId,
          userId: session.user.id,
        }, 120_000, provider, (tokens) => {
          send({ type: "ai_progress", tokens });
        });
      } catch (err) {
        console.error("[generate] generateJSON failed:", err);
        send({ type: "error", message: "Something went wrong — please try again in a few minutes." });
        return;
      }

      const candidate =
        Array.isArray(rawResponse)
          ? rawResponse
          : (rawResponse as Record<string, unknown>)?.days ?? rawResponse;

      const validated = itineraryResponseSchema.safeParse(candidate);
      if (!validated.success) {
        console.error("[generate] AI returned invalid structure:", validated.error.issues);
        send({ type: "error", message: "Something went wrong — please try again in a few minutes." });
        return;
      }

      send({ type: "step", step: "ai", status: "done" });

      const days = validated.data;

      // ── Step 3: schedule — save days + items to DB ──────────────
      const insertedDays = await insertDays(
        days.map((d) => ({
          tripId,
          dayNumber: d.dayNumber,
          date: d.date,
          theme: d.theme,
          summary: d.summary,
        })),
      );

      const dayIdMap = new Map(insertedDays.map((d) => [d.dayNumber, d.id]));

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

      const insertedItems = await insertItems(itemRows);
      send({ type: "step", step: "schedule", status: "done" });

      // ── Steps 4+5: research + verdicts — place cards ────────────
      const activityItems = insertedItems.filter(
        (i) => i.type === "activity" || i.type === "meal",
      );

      const cards: Awaited<ReturnType<typeof insertPlaceCard>>[] = [];

      send({ type: "step", step: "research", status: "active" });

      if (activityItems.length > 0) {
        const [cardPromptRow, cardSettings] = await Promise.all([
          getActivePrompt("place_card"),
          getAllSettings(),
        ]);
        const cardModel =
          cardSettings.find((s) => s.key === "model_place_card")?.value ??
          cardSettings.find((s) => s.key === "model")?.value;
        const cardProvider =
          cardSettings.find((s) => s.key === "provider")?.value ?? "openrouter";

        if (cardPromptRow) {
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

          const MAX_CONCURRENCY = 6;
          for (let i = 0; i < activityItems.length; i += MAX_CONCURRENCY) {
            const chunk = activityItems.slice(i, i + MAX_CONCURRENCY);
            const promises = chunk.map(async (item) => {
              const payload = await buildCardPayload(
                { id: item.id, title: item.title, category: item.category, location: item.location },
                tripCtx,
                cardPromptRow.template,
                cardModel,
                false,
                session.user.id,
                cardProvider,
              );
              if (!payload) return null;
              const card = await insertPlaceCard({ ...payload, tripId });
              await linkItemToCard(item.id, card.id);
              // Stream this card to the client immediately as it resolves
              send({
                type: "card",
                card: {
                  id: card.id,
                  name: card.name,
                  category: card.category ?? null,
                  verdict: card.verdict,
                  imageUrl: card.imageUrl ?? null,
                  summary: card.summary ?? null,
                },
              });
              return card;
            });

            const results = await Promise.allSettled(promises);
            for (const r of results) {
              if (r.status === "fulfilled" && r.value != null) cards.push(r.value);
            }
          }
        }
      }

      send({ type: "step", step: "research", status: "done" });
      send({ type: "step", step: "verdicts", status: "done" });

      // ── Step 6: finalise ────────────────────────────────────────
      await updateTrip(tripId, session.user.id, { status: "active" });
      send({ type: "step", step: "finalise", status: "done" });

      send({ type: "complete", days: insertedDays.length, cards: cards.length });
    } catch (err) {
      console.error("[generate] SSE generation failed:", err);
      send({ type: "error", message: "Something went wrong — please try again in a few minutes." });
    } finally {
      writer.close().catch(() => undefined);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

