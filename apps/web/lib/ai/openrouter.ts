import OpenAI from "openai";
import { db } from "@/lib/db";
import { aiTelemetry } from "@/lib/db/schema";

// ─── Provider configuration ───────────────────────────────────────────────────
// Keys live in .env.local only — never exposed to the client.
// The active provider is chosen via Admin › AI Settings › "provider".

interface ProviderConfig {
  /** env var name that holds the API key */
  apiKeyEnv: string;
  /** OpenAI-compatible base URL (omit for native OpenAI) */
  baseURL?: string;
  /** Extra headers required by the provider */
  defaultHeaders?: Record<string, string>;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    apiKeyEnv: "OPENAI_API_KEY",
  },
  openrouter: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://routecrafted.com",
      "X-Title": "RouteCrafted",
    },
  },
};

/** Human-readable labels shown in Admin UI */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

/** Suggested models per provider shown in Admin UI as hints */
export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini", "o4-mini"],
  openrouter: [
    "deepseek/deepseek-chat",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3-haiku",
    "meta-llama/llama-3.1-8b-instruct",
  ],
};

// ─── Client cache (one OpenAI SDK instance per provider) ─────────────────────

const _clients = new Map<string, OpenAI>();

function getClient(provider: string): OpenAI {
  const existing = _clients.get(provider);
  if (existing) return existing;

  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown AI provider "${provider}". Valid options: ${Object.keys(PROVIDER_CONFIGS).join(", ")}`);

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`API key not set. Add ${config.apiKeyEnv}=<key> to .env.local`);

  const client = new OpenAI({
    apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(config.defaultHeaders ? { defaultHeaders: config.defaultHeaders } : {}),
  });

  _clients.set(provider, client);
  return client;
}

// ─── Cost estimation (per 1M tokens [input, output] in USD) ──────────────────

const MODEL_COSTS: Record<string, [number, number]> = {
  // OpenAI native
  "gpt-4o": [2.50, 10.00],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4.1": [2.00, 8.00],
  "gpt-4.1-mini": [0.40, 1.60],
  "gpt-4.1-nano": [0.10, 0.40],
  "o1-mini": [1.10, 4.40],
  "o3-mini": [1.10, 4.40],
  "o4-mini": [1.10, 4.40],
  // OpenRouter (via prefix)
  "openai/gpt-4o": [2.50, 10.00],
  "openai/gpt-4o-mini": [0.15, 0.60],
  "deepseek/deepseek-chat": [0.14, 0.28],
  "deepseek/deepseek-r1": [0.55, 2.19],
  "google/gemini-2.0-flash-001": [0.10, 0.40],
  "anthropic/claude-3-haiku": [0.25, 1.25],
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number | null {
  const rates = MODEL_COSTS[model];
  if (!rates) return null;
  return (promptTokens / 1_000_000) * rates[0] + (completionTokens / 1_000_000) * rates[1];
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface TelemetryContext {
  callType?: string;
  tripId?: string;
  dayId?: string;
  itemId?: string;
  userId?: string;
}

export async function generateJSON<T>(
  prompt: string,
  model?: string,
  telemetry?: TelemetryContext,
  timeoutMs = 25_000,
  provider = "openrouter",
  /** Optional callback fired as tokens stream in. Enables streaming mode. */
  onProgress?: (tokensSoFar: number) => void,
): Promise<T> {
  const client = getClient(provider);
  const resolvedModel =
    model ??
    (provider === "openai" ? process.env.OPENAI_MODEL : undefined) ??
    process.env.OPENROUTER_MODEL;
  if (!resolvedModel)
    throw new Error(
      `No AI model configured for provider "${provider}". Set the model in Admin › AI Settings.`,
    );

  const startMs = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let totalTokens: number | null = null;
  let content: string | null = null;

  try {
    if (onProgress) {
      // ── Streaming mode: accumulate tokens, call onProgress periodically ──
      const stream = await client.chat.completions.create(
        {
          model: resolvedModel,
          messages: [
            { role: "system", content: "You are a helpful AI assistant. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      );

      let accumulated = "";
      let tokenCount = 0;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          tokenCount += 1;
          // Fire callback every 50 tokens
          if (tokenCount % 50 === 0) onProgress(tokenCount);
        }
        // Last chunk carries usage stats
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? null;
          completionTokens = chunk.usage.completion_tokens ?? null;
          totalTokens = chunk.usage.total_tokens ?? null;
        }
      }
      onProgress(tokenCount); // final call
      content = accumulated || null;
    } else {
      // ── Non-streaming mode (default) ──────────────────────────────────────
      const completion = await client.chat.completions.create(
        {
          model: resolvedModel,
          messages: [
            { role: "system", content: "You are a helpful AI assistant. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      );
      const usage = completion.usage;
      promptTokens = usage?.prompt_tokens ?? null;
      completionTokens = usage?.completion_tokens ?? null;
      totalTokens = usage?.total_tokens ?? null;
      content = completion.choices[0].message.content ?? null;
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    db.insert(aiTelemetry).values({
      callType: telemetry?.callType ?? null,
      model: resolvedModel,
      tripId: telemetry?.tripId ?? null,
      dayId: telemetry?.dayId ?? null,
      itemId: telemetry?.itemId ?? null,
      userId: telemetry?.userId ?? null,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage,
    }).catch(() => undefined);
    throw err;
  }

  const latencyMs = Date.now() - startMs;
  const estimatedCostUsd =
    promptTokens != null && completionTokens != null
      ? estimateCost(resolvedModel, promptTokens, completionTokens)
      : null;

  db.insert(aiTelemetry).values({
    callType: telemetry?.callType ?? null,
    model: resolvedModel,
    tripId: telemetry?.tripId ?? null,
    dayId: telemetry?.dayId ?? null,
    itemId: telemetry?.itemId ?? null,
    userId: telemetry?.userId ?? null,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimatedCostUsd != null ? String(estimatedCostUsd) : null,
    latencyMs,
    success,
  }).catch(() => undefined);

  if (!content) throw new Error("AI provider returned an empty response");
  return JSON.parse(content) as T;
}
