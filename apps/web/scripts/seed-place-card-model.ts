/**
 * One-time script — seeds model_place_card setting in the DB.
 * Idempotent: skips if the setting already exists.
 *
 * Run from apps/web/:
 *   npx tsx scripts/seed-place-card-model.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { aiSettings } from "../lib/db/schema";

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema: { aiSettings } });

async function main() {
  const existing = await db
    .select({ key: aiSettings.key })
    .from(aiSettings)
    .where(eq(aiSettings.key, "model_place_card"));

  if (existing.length > 0) {
    console.log("ℹ️  model_place_card already exists — skipping insert.");
    process.exit(0);
  }

  await db.insert(aiSettings).values({
    key: "model_place_card",
    value: "google/gemini-2.0-flash-001",
    description: "OpenRouter model identifier used for place card generation — fast model recommended",
  });

  console.log("✅  Seeded model_place_card = google/gemini-2.0-flash-001");
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  process.exit(1);
});
