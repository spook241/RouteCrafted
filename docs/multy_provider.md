## Plan: Multi-Provider AI + AbortError Fix

**TL;DR:** The `AbortError` is the 25s timeout firing mid-generation (itinerary takes 30–90s). Fix that immediately. Then add switchable providers (OpenAI / OpenRouter / extensible) in Admin — only API keys stay in `.env.local`, everything else (provider, models) lives in DB.

---

### Root cause of AbortError
`generateJSON` defaults to `timeoutMs = 25_000`. The itinerary generation prompt is ~3000 tokens → can take 30–90s. Fix: pass an explicit longer timeout from the route call sites.

---

### Steps

**Phase 1 — Fix AbortError (1 file)**

route.ts — add `120_000` (2 min) as 5th arg to `generateJSON`:
```ts
rawResponse = await generateJSON<unknown>(prompt, model, { ... }, 120_000);
```

route.ts — add `60_000` (1 min):
```ts
rawResponse = await generateJSON<unknown>(prompt, model, { ... }, 60_000);
```

Place cards already default to 25s — fine for short prompts.

---

**Phase 2 — Multi-provider client** (openrouter.ts)

1. Add `PROVIDER_CONFIGS` map — provider name → `{ apiKeyEnv, baseURL?, defaultHeaders? }`:
   - `"openai"` → `{ apiKeyEnv: "OPENAI_API_KEY" }`
   - `"openrouter"` → `{ apiKeyEnv: "OPENROUTER_API_KEY", baseURL: "https://openrouter.ai/api/v1", defaultHeaders: { "HTTP-Referer": ..., "X-Title": ... } }`

2. Change `_client: OpenAI | null` → `_clients: Map<string, OpenAI>` (cache by provider)

3. Update `getClient(provider: string): OpenAI` — reads correct env key per provider, throws clear error if key missing

4. Add `provider` as 5th optional param to `generateJSON` (default `"openrouter"` to preserve existing behaviour): `generateJSON<T>(prompt, model?, telemetry?, timeoutMs?, provider?)`

5. Update `MODEL_COSTS` to include models from both providers:
   - OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `o3-mini`, `o4-mini`
   - OpenRouter: `deepseek/deepseek-chat`, `google/gemini-2.0-flash-001`, etc.

6. Remove hardcoded `"deepseek/deepseek-chat"` fallback; `resolvedModel` = `model ?? process.env.OPENAI_MODEL ?? process.env.OPENROUTER_MODEL`; throw clear error if still `undefined`

---

**Phase 3 — Thread `provider` through the call chain** (3 route files + 1 helper)

card-generator.ts — add `provider?: string` as 7th param to `buildCardPayload`; pass to `generateJSON`

route.ts:
- Read `provider` from settings: `settings.find(s => s.key === "provider")?.value ?? "openrouter"`
- Pass `provider` to `generateJSON` (5th/6th args); pass it down to `buildCardPayload` card loop

route.ts — same pattern

route.ts — same pattern

---

**Phase 4 — Admin DB settings** (ai-config.ts)

Add to `DEFAULT_SETTINGS`:
```ts
{
  key: "provider",
  value: "openrouter",
  description: "AI provider: openai | openrouter — API key must be set in .env.local",
}
```
Model defaults stay as-is (`deepseek/deepseek-chat` for provider=openrouter, or change once provider is switched).

---

**Phase 5 — Admin UI** (AiSettingsPanel.tsx)

1. `SETTING_LABELS`:
   - `"provider"` → `"AI Provider"`
   - `"model"` → `"Model (Itinerary & Rewrite)"`
   - `"model_place_card"` → `"Model (Place Cards)"`

2. Add `SETTING_TYPES` map — mark `"provider"` as `"select"` with options `["openrouter", "openai"]`; render a `<select>` instead of `<input>` when type is "select"

3. Add per-provider env var hint below the provider field: "OpenRouter: set `OPENROUTER_API_KEY` · OpenAI: set `OPENAI_API_KEY`"

---

**Phase 6 — Seed `provider` in live DB** (new script)

`apps/web/scripts/seed-provider-setting.ts` — insert `provider = "openrouter"` if not exists. Run: `npx tsx scripts/seed-provider-setting.ts`

---

**Phase 7 — Type-check**

`cd apps/web && npx tsc --noEmit`

---

### Relevant files
- openrouter.ts — PROVIDER_CONFIGS, client cache, generateJSON signature
- route.ts — timeout fix + provider thread
- route.ts — timeout fix + provider thread
- route.ts — provider thread
- card-generator.ts — add provider param
- ai-config.ts — add provider to DEFAULT_SETTINGS
- AiSettingsPanel.tsx — select UI + labels

### Verification
1. `npx tsc --noEmit` → 0 errors
2. Generate trip with existing `OPENROUTER_API_KEY` → no AbortError, completes in < 90s
3. `/admin/ai` → "AI Provider" shows `openrouter` with a dropdown; change to `openai`
4. Set `OPENAI_API_KEY` in `.env.local`, restart server, generate trip → uses OpenAI
5. Telemetry table records correct model and provider per call

### Decisions
- `provider` is one setting for all call types (not per call-type) — keeps admin simple
- OpenRouter stays as default so nothing breaks before the admin switches it
- Env vars for BOTH providers can coexist in `.env.local` — only the active provider's key is used
- No DB migration needed — `provider` is a new row in existing `aiSettings` table