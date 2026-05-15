import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { itineraryResponseSchema } from "@/lib/ai/schemas";
import { searchGeoapify } from "@/lib/places/geoapify";
import { searchWikimedia } from "@/lib/places/wikimedia";
import { searchPexels } from "@/lib/places/pexels";

export const dynamic = "force-dynamic";

type ServiceResult = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

async function testDatabase(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - t };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function testOpenRouter(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return { ok: false, latencyMs: 0, detail: "OPENROUTER_API_KEY not set" };
    }
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
    const res = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat",
      messages: [{ role: "user", content: 'Reply with {"ok":true}' }],
      response_format: { type: "json_object" },
      max_tokens: 10,
    });
    const content = res.choices[0]?.message?.content ?? "";
    return { ok: content.includes("true"), latencyMs: Date.now() - t, detail: `model: ${res.model}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function testR2(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(
      (k) => !process.env[k]
    );
    if (missing.length) {
      return { ok: false, latencyMs: 0, detail: `Missing env vars: ${missing.join(", ")}` };
    }
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    // HeadBucket works with bucket-scoped tokens; ListBuckets requires account-level permission
    await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME! }));
    return { ok: true, latencyMs: Date.now() - t, detail: `bucket "${process.env.R2_BUCKET_NAME}" reachable · account: ${process.env.R2_ACCOUNT_ID}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function testResend(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { ok: false, latencyMs: 0, detail: "RESEND_API_KEY not set in environment" };
    }
    const keyHint = `key starts with: ${key.slice(0, 10)}…`;
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        if (body.message) errMsg += ` — ${body.message}`;
        else if (body.name) errMsg += ` — ${body.name}`;
      } catch { /* ignore parse error */ }
      return {
        ok: false,
        latencyMs: Date.now() - t,
        detail: `${errMsg} · ${keyHint}${res.status === 401 ? " · API key is invalid or revoked — get a new one at resend.com/api-keys" : ""}`,
      };
    }
    return { ok: true, latencyMs: Date.now() - t, detail: keyHint };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function testOpenMeteo(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&daily=weather_code&forecast_days=1&timezone=auto",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { ok: false, latencyMs: Date.now() - t, detail: `HTTP ${res.status}` };
    return { ok: true, latencyMs: Date.now() - t, detail: "Paris forecast OK" };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

// ─── Geoapify ─────────────────────────────────────────────────────────────────

async function testGeoapify(): Promise<ServiceResult> {
  const t = Date.now();
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) return { ok: false, latencyMs: 0, detail: "GEOAPIFY_API_KEY not set" };
  try {
    // Test with Eiffel Tower — well-known landmark
    const result = await searchGeoapify("Eiffel Tower", 48.8584, 2.2945, "landmark");
    if (!result) return { ok: false, latencyMs: Date.now() - t, detail: "No result returned (key may be wrong or quota exceeded)" };
    return {
      ok: true,
      latencyMs: Date.now() - t,
      detail: `key …${key.slice(-4)} · place_id: ${result.providerId?.slice(0, 20) ?? "n/a"} · category: ${result.category ?? "n/a"}`,
    };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

// ─── Wikimedia ───────────────────────────────────────────────────────────────

async function testWikimedia(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    // No API key required — just test the public API
    const result = await searchWikimedia("Eiffel Tower", "Paris", "landmark");
    if (!result?.imageUrl) return { ok: false, latencyMs: Date.now() - t, detail: "No image found for Eiffel Tower" };
    return {
      ok: true,
      latencyMs: Date.now() - t,
      detail: `No key required · imageUrl: ${result.imageUrl.slice(0, 60)}…`,
    };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

// ─── Pexels ──────────────────────────────────────────────────────────────────

async function testPexels(): Promise<ServiceResult> {
  const t = Date.now();
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return { ok: false, latencyMs: 0, detail: "PEXELS_API_KEY not set" };
  try {
    const result = await searchPexels("Eiffel Tower", "Paris", "landmark");
    if (!result?.imageUrl) return { ok: false, latencyMs: Date.now() - t, detail: "No photo returned (key may be wrong or quota exceeded)" };
    return {
      ok: true,
      latencyMs: Date.now() - t,
      detail: `key …${key.slice(-4)} · photographer: ${result.imageAttribution ?? "n/a"} · imageUrl: ${result.imageUrl.slice(0, 60)}…`,
    };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

// ─── Google Places ───────────────────────────────────────────────────────────

async function testGoogle(): Promise<ServiceResult> {
  const t = Date.now();
  const enabled = process.env.GOOGLE_PLACES_ENABLED;
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return { ok: false, latencyMs: 0, detail: "GOOGLE_PLACES_API_KEY not set" };
  if (enabled !== "true") {
    // Key is present but flag is off — report as OK (intentionally disabled)
    return {
      ok: true,
      latencyMs: Date.now() - t,
      detail: `key …${key.slice(-4)} · GOOGLE_PLACES_ENABLED=false (intentionally disabled — set to true to activate)`,
    };
  }
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating",
      },
      body: JSON.stringify({ textQuery: "Café de Flore Paris", maxResultCount: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, latencyMs: Date.now() - t, detail: `HTTP ${res.status} · ${body.slice(0, 120)}` };
    }
    const data = (await res.json()) as { places?: Array<{ id?: string; displayName?: { text?: string }; rating?: number }> };
    const place = data.places?.[0];
    return {
      ok: true,
      latencyMs: Date.now() - t,
      detail: `key …${key.slice(-4)} · found: "${place?.displayName?.text ?? "n/a"}" · rating: ${place?.rating ?? "n/a"}`,
    };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

function testMapbox(): ServiceResult {
  const t = Date.now();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { ok: false, latencyMs: Date.now() - t, detail: "NEXT_PUBLIC_MAPBOX_TOKEN not set" };
  if (!token.startsWith("pk.")) return { ok: false, latencyMs: Date.now() - t, detail: "Token format invalid (expected pk.*)" };
  return { ok: true, latencyMs: Date.now() - t, detail: "Token present and valid format" };
}

export interface SimulationStep {
  label: string;
  tried: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface SimulationResult {
  ok: boolean;
  totalMs: number;
  steps: SimulationStep[];
  preview?: string;
}

async function testTripSimulation(): Promise<SimulationResult> {
  const steps: SimulationStep[] = [];
  const totalStart = Date.now();

  // ── Step 1: env check ──────────────────────────────────────────────────────
  {
    const t = Date.now();
    const missing = !process.env.OPENROUTER_API_KEY;
    steps.push({
      label: "Environment check",
      tried: "Verify OPENROUTER_API_KEY is set",
      ok: !missing,
      latencyMs: Date.now() - t,
      detail: missing ? "OPENROUTER_API_KEY is not set" : "Key present",
    });
    if (missing) return { ok: false, totalMs: Date.now() - totalStart, steps };
  }

  // ── Step 2: load prompt from DB ────────────────────────────────────────────
  let promptRow: Awaited<ReturnType<typeof getActivePrompt>>;
  let model: string | undefined;
  {
    const t = Date.now();
    try {
      const [p, settings] = await Promise.all([
        getActivePrompt("generate_itinerary"),
        getAllSettings(),
      ]);
      promptRow = p;
      model = settings.find((s) => s.key === "model")?.value;
      steps.push({
        label: "Load active prompt",
        tried: "SELECT active prompt for key=generate_itinerary from aiPrompts table",
        ok: !!promptRow,
        latencyMs: Date.now() - t,
        detail: promptRow
          ? `Loaded prompt v${promptRow.version} · model override: ${model ?? "none (uses env default)"}`
          : "No active prompt found for generate_itinerary — seed AI prompts first",
      });
    } catch (e) {
      steps.push({
        label: "Load active prompt",
        tried: "SELECT active prompt from DB",
        ok: false,
        latencyMs: Date.now() - t,
        detail: String(e),
      });
      return { ok: false, totalMs: Date.now() - totalStart, steps };
    }
    if (!promptRow) return { ok: false, totalMs: Date.now() - totalStart, steps };
  }

  // ── Step 3: interpolate template ───────────────────────────────────────────
  let prompt: string;
  {
    const t = Date.now();
    const vars = {
      destination: "Paris",
      country: "France",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      totalDays: "2",
      budgetRange: "mid-range",
      travelStyle: "cultural",
      groupType: "couple",
      pacing: "balanced",
    };
    prompt = interpolate(promptRow.template, vars);
    const charCount = prompt.length;
    steps.push({
      label: "Interpolate prompt template",
      tried: `Replace {{variables}} with mock trip values: ${Object.keys(vars).join(", ")}`,
      ok: true,
      latencyMs: Date.now() - t,
      detail: `Prompt ready · ${charCount} characters`,
    });
  }

  // ── Step 4: call OpenRouter AI ─────────────────────────────────────────────
  let rawResponse: unknown;
  {
    const t = Date.now();
    const usedModel = model ?? process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat";
    try {
      rawResponse = await generateJSON<unknown>(prompt, model);
      steps.push({
        label: "Call OpenRouter AI",
        tried: `POST https://openrouter.ai/api/v1/chat/completions · model: ${usedModel}`,
        ok: true,
        latencyMs: Date.now() - t,
        detail: `Response received · ${JSON.stringify(rawResponse).length} chars`,
      });
    } catch (e) {
      steps.push({
        label: "Call OpenRouter AI",
        tried: `POST https://openrouter.ai/api/v1/chat/completions · model: ${usedModel}`,
        ok: false,
        latencyMs: Date.now() - t,
        detail: String(e),
      });
      return { ok: false, totalMs: Date.now() - totalStart, steps };
    }
  }

  // ── Step 5: unwrap & validate schema ──────────────────────────────────────
  {
    const t = Date.now();
    const candidate = Array.isArray(rawResponse)
      ? rawResponse
      : (rawResponse as Record<string, unknown>)?.days ?? rawResponse;

    const validated = itineraryResponseSchema.safeParse(candidate);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `[${i.path.join(".") || "root"}] ${i.message}`).join(" · ");
      steps.push({
        label: "Validate itinerary schema",
        tried: "Parse response as ItineraryDay[] with Zod (dayNumber, date, theme, summary, items[])",
        ok: false,
        latencyMs: Date.now() - t,
        detail: issues,
      });
      return { ok: false, totalMs: Date.now() - totalStart, steps };
    }

    const days = validated.data;
    const totalItems = days.reduce((sum, d) => sum + d.items.length, 0);
    const preview = `${days.length} days · ${totalItems} items · Day 1: "${days[0].theme}" (${days[0].items.length} items)`;
    steps.push({
      label: "Validate itinerary schema",
      tried: "Parse response as ItineraryDay[] with Zod (dayNumber, date, theme, summary, items[])",
      ok: true,
      latencyMs: Date.now() - t,
      detail: preview,
    });

    return { ok: true, totalMs: Date.now() - totalStart, steps, preview };
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [database, openrouter, r2, resend, openmeteo, geoapify, wikimedia, pexels, google] = await Promise.all([
    testDatabase(),
    testOpenRouter(),
    testR2(),
    testResend(),
    testOpenMeteo(),
    testGeoapify(),
    testWikimedia(),
    testPexels(),
    testGoogle(),
  ]);

  const mapbox = testMapbox();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    services: {
      database,
      openrouter,
      r2,
      resend,
      openmeteo,
      mapbox,
      places_enrichment: {
        geoapify,
        wikimedia,
        pexels,
        google,
      },
    },
  });
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await testTripSimulation();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    simulation: result,
  });
}
