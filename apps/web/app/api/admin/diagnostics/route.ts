import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { getActivePrompt, getAllSettings } from "@/lib/db/ai-config";
import { generateJSON } from "@/lib/ai/openrouter";
import { interpolate } from "@/lib/ai/interpolate";
import { itineraryResponseSchema } from "@/lib/ai/schemas";

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
    await client.send(new ListBucketsCommand({}));
    return { ok: true, latencyMs: Date.now() - t, detail: `bucket: ${process.env.R2_BUCKET_NAME}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function testResend(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, latencyMs: 0, detail: "RESEND_API_KEY not set" };
    }
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) return { ok: false, latencyMs: Date.now() - t, detail: `HTTP ${res.status}` };
    return { ok: true, latencyMs: Date.now() - t };
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

async function testOpenTripMap(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    if (!process.env.OPENTRIPMAP_KEY) {
      return { ok: false, latencyMs: 0, detail: "OPENTRIPMAP_KEY not set" };
    }
    const res = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?radius=100&lon=2.3522&lat=48.8566&limit=1&apikey=${process.env.OPENTRIPMAP_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { ok: false, latencyMs: Date.now() - t, detail: `HTTP ${res.status}` };
    return { ok: true, latencyMs: Date.now() - t };
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

  const [database, openrouter, r2, resend, openmeteo, opentripmap] = await Promise.all([
    testDatabase(),
    testOpenRouter(),
    testR2(),
    testResend(),
    testOpenMeteo(),
    testOpenTripMap(),
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
      opentripmap,
      mapbox,
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
