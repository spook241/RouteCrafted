/**
 * Seed script — adds the `provider` AI setting if it doesn't exist.
 * Run once:  npx tsx scripts/seed-provider-setting.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { aiSettings } from "../lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { aiSettings } });

async function main() {
  const existing = await db
    .select({ key: aiSettings.key })
    .from(aiSettings)
    .where(eq(aiSettings.key, "provider"));

  if (existing.length > 0) {
    console.log("✅  provider setting already exists — skipping.");
    return;
  }

  await db.insert(aiSettings).values({
    key: "provider",
    value: "openrouter",
    description:
      "AI provider — openai or openrouter. API key must be set in .env.local (OPENAI_API_KEY or OPENROUTER_API_KEY).",
  });

  console.log("✅  Seeded provider = openrouter");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
