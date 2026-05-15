Phase 1 — Schema + Migration

Add ai_telemetry table to schema.ts:

id uuid PK
callType text — "generate_itinerary" | "rewrite_day" | "place_card"
tripId uuid nullable FK → trips
dayId uuid nullable FK → itinerary_days — populated for rewrite_day calls
itemId uuid nullable FK → itinerary_items — populated for place_card calls
userId uuid nullable FK → users
model text
promptTokens integer nullable
completionTokens integer nullable
totalTokens integer nullable
estimatedCostUsd numeric(10,6) nullable
latencyMs integer nullable
success boolean notNull default true
errorMessage text nullable
createdAt timestamp defaultNow
Run drizzle-kit generate + drizzle-kit migrate

Phase 2 — Instrument generateJSON

Update openrouter.ts — add optional context param:

Capture latency, read completion.usage, compute cost from MODEL_COSTS map, fire-and-forget insert
Add MODEL_COSTS map (DeepSeek input/output rates per 1M tokens)

Phase 3 — Pass context from each call site

itinerary/generate/route.ts → { callType: "generate_itinerary", tripId, userId }
itinerary/rewrite-day/route.ts → { callType: "rewrite_day", tripId, dayId, userId }
places/card-generator.ts → { callType: "place_card", tripId, itemId } — itemId is the itinerary item being evaluated
Phase 4 — DB helpers — create apps/web/lib/db/telemetry.ts:

insertTelemetry(row) — insert one row
getTelemetrySummary() — global totals + breakdown by callType
getTripTelemetry(tripId) — all rows for one trip ordered by createdAt, joined with day.dayNumber and item.title for display labels
getTelemetryByTrip() — one row per trip: total calls, total tokens, total cost, last call time
Phase 5 — Admin UI

Create apps/web/app/admin/telemetry/page.tsx — two views:

Summary view: global stat chips (total calls, tokens, cost) + table of trips with aggregated cost/tokens, each row links to /admin/telemetry/[tripId]
Nav card added to admin/page.tsx
Create apps/web/app/admin/telemetry/[tripId]/page.tsx — drill-down view:

Trip header (destination, dates)
Total cost + token chips for that trip
Grouped sections:
Itinerary Generation — 1 row (the generate call)
Day Rewrites — N rows, labeled "Day 1 — Theme", "Day 2 — Theme"
Place Cards — N rows, labeled with item.title
Relevant files

schema.ts — new table
openrouter.ts — instrument
apps/web/lib/db/telemetry.ts — new (create)
itinerary/generate/route.ts
itinerary/rewrite-day/route.ts
places/card-generator.ts
admin/telemetry/page.tsx — new (create)
admin/telemetry/[tripId]/page.tsx — new (create)
admin/page.tsx — add nav card
Verification

Migration applies cleanly
Generate a trip → DB has 1 generate_itinerary row + N place_card rows all with correct tripId
Rewrite a day → 1 rewrite_day row with dayId populated
/admin/telemetry lists trips with cost totals; drill-down shows individual calls grouped by type
/admin/telemetry redirects non-admins to /dashboard
npx tsc --noEmit passes
