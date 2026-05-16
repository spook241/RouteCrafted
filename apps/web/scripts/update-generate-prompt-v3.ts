/**
 * One-time script — inserts a v3 generate_itinerary prompt that:
 *  - Removes "hotel" category and "transport" type from the item spec
 *  - Adds explicit IMPORTANT RULES block forbidding hotel/airport logistics
 *  - Supports {{userNotes}} placeholder
 *
 * Run from apps/web/:
 *   npx tsx scripts/update-generate-prompt-v3.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { aiPrompts } from "../lib/db/schema";

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema: { aiPrompts } });

const TEMPLATE = `You are a professional travel planner. Create a detailed day-by-day itinerary for the following trip.

IMPORTANT RULES — follow strictly:
- Do NOT include hotel check-in/check-out, airport arrivals/departures, flights, or any accommodation logistics.
- Do NOT plan transport to/from the airport or any inter-city travel.
- Every item must be a real on-the-ground experience: sightseeing, dining, leisure, or local transit between nearby attractions.
- Focus on what to SEE, DO, and EAT — not where to sleep or how to arrive.

Trip details:
- Destination: {{destination}}, {{country}}
- Start Date: {{startDate}}
- End Date: {{endDate}}
- Total Days: {{totalDays}}
- Budget: {{budgetRange}}
- Travel Style: {{travelStyle}}
- Group Type: {{groupType}}
- Pacing: {{pacing}}

Return a JSON object with a "days" array. Each day must have:
- dayNumber (integer, 1-based)
- date (YYYY-MM-DD string)
- theme (short catchy title for the day)
- summary (1-2 sentences what the day covers)
- items (array of activities)

Each item must have:
- timeBlock: one of "morning", "afternoon", "evening"
- type: one of "activity", "meal"
- category: one of "museum", "landmark", "historic", "park", "nature", "restaurant", "cafe", "bar", "bakery", "neighborhood", "shopping", "beach", "viewpoint", "activity", "attraction"
- title (name of the place or activity)
- description (2-3 sentences with useful details)
- location (address or area)
- durationMins (positive integer)
- estimatedCost (non-negative number in USD)
- isOptional (boolean)
- tips (string or null — one practical insider note, e.g. "Book tickets online to skip the queue", null if nothing special)
- bookingRequired (boolean — true if pre-booking is typically needed, otherwise false)

Pacing guide: relaxed = 2-3 items/day, moderate = 3-4 items/day, packed = 5-6 items/day.
Budget guide: budget = under $30/day activities, mid = $30-$100/day, luxury = $100+/day.
{{userNotes}}
Return ONLY valid JSON.`;

async function main() {
  const rows = await db
    .select({ version: aiPrompts.version })
    .from(aiPrompts)
    .where(eq(aiPrompts.promptKey, "generate_itinerary"))
    .orderBy(desc(aiPrompts.version));

  if (rows.length === 0) {
    console.log("ℹ️  No existing generate_itinerary prompts found — run seedDefaults() first.");
    process.exit(0);
  }

  const nextVersion = rows[0].version + 1;

  // Deactivate all existing generate_itinerary prompts
  await db
    .update(aiPrompts)
    .set({ isActive: false })
    .where(eq(aiPrompts.promptKey, "generate_itinerary"));

  // Insert new active version
  const [inserted] = await db
    .insert(aiPrompts)
    .values({
      promptKey: "generate_itinerary",
      version: nextVersion,
      isActive: true,
      name: `v${nextVersion} — no hotel/airport, userNotes`,
      description: "Forbids hotel/airport items; removes hotel/transport from category enum; supports {{userNotes}}.",
      template: TEMPLATE,
    })
    .returning({ id: aiPrompts.id, version: aiPrompts.version });

  console.log(`✅  Inserted generate_itinerary v${inserted.version} (id: ${inserted.id}) and set active.`);
  console.log(`    Previous ${rows.length} version(s) deactivated.`);
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  process.exit(1);
});
