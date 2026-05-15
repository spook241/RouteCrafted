# Plan: Auto-generate Place Cards + Per-card Swap + Day/Time on Card

## TL;DR
Four changes: (1) auto-generate cards as part of itinerary generation, (2) "Generate All" replaces ALL existing cards, (3) per-card "Swap" picks a NEW unlinked activity item, (4) each card shows its day number + time block from the itinerary.

---

# Previous Plan: Edit Trip Dates & Details (COMPLETED)

## Context

The trip detail page (`/trips/[id]`) shows dates and 4 details (budget, style, group, pacing) as **read-only**. No edit UI exists. `TripForm` is creation-only. `PATCH /api/trips/[id]` already supports all fields. The itinerary generate endpoint blocks with 409 if days exist — no "clear itinerary" endpoint exists. Place cards are trip-scoped (not day-scoped) and survive a date change. Changing dates with an existing itinerary silently misaligns `itinerary_days.date` — no warning, no invalidation.

---

# OLD Plan: Weather Icons in Date Picker Calendar

## TL;DR
Add small weather emoji + temperature overlays on each calendar day inside `DateRangePicker` when the user has already selected a destination (has lat/lon). A new lightweight API route serves a 16-day Open-Meteo preview. A custom `DayButton` component renders weather below each date number.

## Steps

### Phase 1 — New API route (no dependencies)
1. Create `apps/web/app/api/weather/preview/route.ts`
   - GET with query params `?lat=&lon=&days=16` (max 16)
   - Calls `getForecast(lat, lon, today, today+days-1)` from `lib/weather/open-meteo.ts`
   - Returns `{ forecast: [{ date, emoji, maxTempC }] }` — no auth needed (no user data)
   - Still validate lat/lon are numeric to prevent injection

### Phase 2 — DateRangePicker additions (*depends on Phase 1*)
2. Add optional props `lat?: string | null` and `lon?: string | null` to `DateRangePickerProps`
3. Add `forecastMap: Map<string, { emoji: string; maxTempC: number }>` state + loading bool
4. `useEffect` on `open` — when `open===true` and lat/lon present and map is empty → fetch `/api/weather/preview`
5. Extract `wmoEmoji(code)` helper (already exists in WeatherAlertBanner — copy inline, small function)
6. Add custom `WeatherDayButton` component using v9 `components.DayButton`:
   - Receives standard DayButton props + forecast map via closure
   - Renders: date number + weather line (emoji + °C, 10px) below
   - Only renders weather line when date is in forecastMap (within 16-day window)
7. Update CSS: increase `.rcal-day` height from 40px → 56px to accommodate weather row
8. Add tiny loading spinner in the calendar caption area when fetching

### Phase 3 — TripForm passes lat/lon (*depends on Phase 2*)
9. Pass `lat={lat}` and `lon={long}` to `<DateRangePicker>` in `TripForm.tsx`

## Relevant Files
- `apps/web/app/api/weather/preview/route.ts` — NEW
- `apps/web/lib/weather/open-meteo.ts` — reuse `getForecast()` and `wmoLabel()`; add `wmoEmoji()` export
- `apps/web/components/trips/DateRangePicker.tsx` — main changes
- `apps/web/components/trips/TripForm.tsx` — pass lat/lon props

## Verification
1. Create trip with a known destination (e.g. Paris) → open calendar → should see emoji + temp on next 16 days
2. Open calendar before selecting destination → no weather overlay (graceful degradation)
3. Dates beyond 16 days show just the number, no overlay
4. Selected/range days still look correct (blue circles, range band)

## Decisions
- **No auth on preview route** — lat/lon is not sensitive user data; keeps it fast and simple
- **16 days** — Open-Meteo free tier default; beyond that there's no data anyway
- **Fetch on open** — lazy, only fetches when user actually opens the calendar
- **wmoEmoji extracted to open-meteo.ts** — single source of truth, reusable

## Out of Scope
- Not updating the existing trip detail weather (different feature)
- Not showing precipitation probability in calendar (too cramped)
