import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiPrompts, aiSettings, users } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiPrompt = typeof aiPrompts.$inferSelect;
export type AiSetting = typeof aiSettings.$inferSelect;

// ─── Available variables per prompt key (for admin UI hints) ─────────────────

export const PROMPT_VARIABLES: Record<string, string[]> = {
  generate_itinerary: [
    "destination",
    "country",
    "startDate",
    "endDate",
    "totalDays",
    "budgetRange",
    "travelStyle",
    "groupType",
    "pacing",
  ],
  rewrite_day: [
    "destination",
    "country",
    "dayNumber",
    "date",
    "theme",
    "summary",
    "budgetRange",
    "travelStyle",
    "groupType",
    "pacing",
    "weatherContext",
  ],
  place_card: [
    "name",
    "category",
    "location",
    "destination",
    "country",
    "travelStyle",
    "groupType",
    "budgetRange",
  ],
};

export const SETTING_VARIABLES: Record<string, string[]> = {
  rewrite_day_weather_context: ["weatherLabel", "forecastCode"],
  rewrite_day_reason_context: ["reason"],
};

// ─── Default templates ────────────────────────────────────────────────────────

const DEFAULT_GENERATE_TEMPLATE = `You are a professional travel planner. Create a detailed day-by-day itinerary for the following trip.

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

const DEFAULT_REWRITE_TEMPLATE = `You are a professional travel planner. Rewrite the itinerary for one day of a trip to {{destination}}, {{country}}.

Current day details:
- Day {{dayNumber}} — {{date}}
- Theme: {{theme}}
- Summary: {{summary}}
- Budget: {{budgetRange}}
- Travel Style: {{travelStyle}}
- Group Type: {{groupType}}
- Pacing: {{pacing}}{{weatherContext}}

Return a JSON object with a single day that has:
- dayNumber (integer)
- date (YYYY-MM-DD, keep the same date: {{date}})
- theme (updated theme for the day)
- summary (1-2 sentences)
- items (array of activities)

Each item must have:
- timeBlock: one of "morning", "afternoon", "evening"
- type: one of "activity", "meal", "transport"
- title
- description (2-3 sentences)
- location
- durationMins (positive integer)
- estimatedCost (non-negative number in USD)
- isOptional (boolean)

Return ONLY valid JSON.`;

const DEFAULT_PLACE_CARD_TEMPLATE = `You are a knowledgeable travel advisor. Evaluate this place/attraction for a traveler.

Place: {{name}}
Category: {{category}}
Location: {{location}}, {{destination}}, {{country}}
Travel style: {{travelStyle}}
Group type: {{groupType}}
Budget: {{budgetRange}}

Respond with a JSON object (no markdown):
{
  "verdict": "worth_it" | "skip_it" | "depends",
  "summary": "One punchy sentence about this place",
  "worthItReasons": ["reason1", "reason2", "reason3"],
  "skipItReasons": ["reason1", "reason2"],
  "bestFor": "Short description of who should visit",
  "costLevel": "free" | "low" | "medium" | "high",
  "timeNeeded": "e.g. 1\u20132 hours"
}`;

const DEFAULT_SETTINGS = [
  {
    key: "model",
    value: "deepseek/deepseek-chat",
    description: "OpenRouter model identifier used for all AI calls",
  },
  {
    key: "rewrite_day_weather_context",
    value: `\nIMPORTANT: The weather forecast for this day is "{{weatherLabel}}" (WMO code {{forecastCode}}). Replace any outdoor or weather-sensitive activities with suitable indoor alternatives.`,
    description:
      "Injected into the rewrite_day prompt when a weather forecast is provided. Supports {{weatherLabel}} and {{forecastCode}}.",
  },
  {
    key: "rewrite_day_reason_context",
    value: `\nReason for rewrite: {{reason}}`,
    description:
      "Injected into the rewrite_day prompt when a custom reason is provided. Supports {{reason}}.",
  },
];

// ─── Seed defaults (idempotent) ───────────────────────────────────────────────

export async function seedDefaults() {
  const existingPromptRows = await db
    .select({ key: aiPrompts.promptKey })
    .from(aiPrompts);
  const seededKeys = new Set(existingPromptRows.map((r) => r.key));

  const DEFAULT_PROMPTS = [
    {
      promptKey: "generate_itinerary",
      version: 1,
      isActive: true,
      name: "Default v1",
      description: "Generates a full day-by-day itinerary from trip preferences.",
      template: DEFAULT_GENERATE_TEMPLATE,
    },
    {
      promptKey: "rewrite_day",
      version: 1,
      isActive: true,
      name: "Default v1",
      description:
        "Rewrites a single day's itinerary, optionally adapting to weather.",
      template: DEFAULT_REWRITE_TEMPLATE,
    },
    {
      promptKey: "place_card",
      version: 1,
      isActive: true,
      name: "Default v1",
      description: "Generates a Worth It / Skip It card for a single place.",
      template: DEFAULT_PLACE_CARD_TEMPLATE,
    },
  ];

  const toInsertPrompts = DEFAULT_PROMPTS.filter(
    (p) => !seededKeys.has(p.promptKey),
  );
  if (toInsertPrompts.length > 0) {
    await db.insert(aiPrompts).values(toInsertPrompts);
  }

  const existingSettings = await db.select({ key: aiSettings.key }).from(aiSettings);
  const existingKeys = new Set(existingSettings.map((s) => s.key));
  const toInsert = DEFAULT_SETTINGS.filter((s) => !existingKeys.has(s.key));
  if (toInsert.length > 0) {
    await db.insert(aiSettings).values(toInsert);
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAllPrompts() {
  return db
    .select()
    .from(aiPrompts)
    .orderBy(desc(aiPrompts.promptKey), desc(aiPrompts.version));
}

export async function getActivePrompt(promptKey: string) {
  const rows = await db
    .select()
    .from(aiPrompts)
    .where(eq(aiPrompts.promptKey, promptKey))
    .orderBy(desc(aiPrompts.isActive), desc(aiPrompts.version))
    .limit(1);
  // prefer isActive=true; fall back to latest version
  return rows[0] ?? null;
}

export async function getAllSettings() {
  return db.select().from(aiSettings);
}

export async function getSetting(key: string) {
  const rows = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.key, key))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createPromptVersion(data: {
  promptKey: string;
  name: string;
  description: string;
  template: string;
  createdBy: string;
}) {
  // get current max version for this key
  const existing = await db
    .select({ v: aiPrompts.version })
    .from(aiPrompts)
    .where(eq(aiPrompts.promptKey, data.promptKey))
    .orderBy(desc(aiPrompts.version))
    .limit(1);
  const nextVersion = (existing[0]?.v ?? 0) + 1;

  // deactivate all existing versions for this key
  await db
    .update(aiPrompts)
    .set({ isActive: false })
    .where(eq(aiPrompts.promptKey, data.promptKey));

  // insert new active version
  const [created] = await db
    .insert(aiPrompts)
    .values({ ...data, version: nextVersion, isActive: true })
    .returning();

  return created;
}

export async function activatePromptVersion(id: string, promptKey: string) {
  // deactivate all for key, then activate the requested one
  await db
    .update(aiPrompts)
    .set({ isActive: false })
    .where(eq(aiPrompts.promptKey, promptKey));

  const [updated] = await db
    .update(aiPrompts)
    .set({ isActive: true })
    .where(eq(aiPrompts.id, id))
    .returning();

  return updated ?? null;
}

export async function upsertSetting(
  key: string,
  value: string,
  updatedBy: string,
) {
  const existing = await getSetting(key);
  if (existing) {
    const [updated] = await db
      .update(aiSettings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(aiSettings.key, key))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(aiSettings)
    .values({ key, value, updatedBy })
    .returning();
  return created;
}
