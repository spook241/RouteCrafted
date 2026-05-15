/**
 * One-time script — inserts a v2 generate_itinerary prompt with the `category`
 * field and activates it, deactivating any previous active version.
 *
 * Run from apps/web/:
 *   npx tsx scripts/update-generate-prompt-v2.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, max } from "drizzle-orm";
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
- type: one of "activity", "meal", "transport"
- category: one of "museum", "landmark", "historic", "park", "nature", "restaurant", "cafe", "bar", "bakery", "hotel", "neighborhood", "shopping", "beach", "viewpoint", "activity", "attraction", "transport"
- title (name of the place or activity)
- description (2-3 sentences with useful details)
- location (address or area)
- durationMins (positive integer)
- estimatedCost (non-negative number in USD)
- isOptional (boolean)

Pacing guide: relaxed = 2-3 items/day, moderate = 3-4 items/day, packed = 5-6 items/day.
Budget guide: budget = under $30/day activities, mid = $30-$100/day, luxury = $100+/day.
Return ONLY valid JSON.`;

async function main() {
  // Find current max version for generate_itinerary
  const rows = await db
    .select({ version: aiPrompts.version })
    .from(aiPrompts)
    .where(eq(aiPrompts.promptKey, "generate_itinerary"));

  const maxVersion = rows.reduce((m, r) => Math.max(m, r.version), 0);
  const nextVersion = maxVersion + 1;

  if (nextVersion === 1) {
    console.log("ℹ️  No existing generate_itinerary prompts found — use seedDefaults() instead.");
    process.exit(0);
  }

  // Deactivate all existing generate_itinerary prompts
  await db
    .update(aiPrompts)
    .set({ isActive: false })
    .where(eq(aiPrompts.promptKey, "generate_itinerary"));

  // Insert new active v2 prompt
  const [inserted] = await db
    .insert(aiPrompts)
    .values({
      promptKey: "generate_itinerary",
      version: nextVersion,
      isActive: true,
      name: `v${nextVersion} — with category`,
      description: "Adds category field to each itinerary item for enrichment lookup.",
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
