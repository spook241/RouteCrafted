Let me check the current generate route in full to plan the SSE changes precisely: 

Read [](file:///c%3A/Work/AI_FULL_STACK/RouteCrafted/apps/web/app/api/itinerary/generate/route.ts)

Good — I have everything. Updating the plan now. 

Updated memory file [](file:///c%3A/Users/admin/AppData/Roaming/Code/User/workspaceStorage/858e7378bb3df896943487e69897d84c/GitHub.copilot-chat/memory-tool/memories/MmMzMjAwYTQtMGJjYy00N2I3LTkwNzktY2Y1M2ZmOWQ2N2E3/plan.md)

Here's the updated plan:

---

## Plan: Generation Progress Modal (SSE — updated)

**TL;DR** — Convert the generate route to emit Server-Sent Events so the client gets real step updates. The modal's primary focus is a rich content hero (destination image + rotating travel tips). The progress/steps sit elegantly below. Half-screen size. Friendly non-red error copy.

---

### Modal visual layout (max-w-lg, ~520px, centered overlay)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   [Cover image / horizon-gradient hero]         │  ← 55% height
│                                                 │
│   Paris, France                ← large bold     │
│   May 20 – May 25  ·  6 nights                 │
│                                                 │
│   ┌──────────────────────────────────────────┐  │
│   │  💡 "Mornings are best for popular       │  │  ← rotating tip
│   │     attractions — fewer crowds, softer   │  │     fades every 4s
│   │     light."                              │  │
│   └──────────────────────────────────────────┘  │
│   [Cultural]  [Couple]  [Mid]  [Moderate]       │  ← chips on image
├─────────────────────────────────────────────────┤
│                                                 │
│   ●────●────◉────○────○                        │  ← step dots
│   ✓    ✓  spin  ○    ○                         │
│                                                 │
│   Step 3 of 5 — Saving your days               │  ← active label
│                                                 │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  58%             │  ← thin bar
└─────────────────────────────────────────────────┘
```

**Completion state** (all dots green):
```
│   ●────●────●────●────●     ✓ all done        │
│                                                 │
│   🗓  6 days planned  ·  ☆  14 places found   │
│                                                 │
│         [ View My Itinerary  → ]               │
└─────────────────────────────────────────────────┘
```

**Error state** (no red — friendly):
```
│   Something went wrong — please try again      │
│   in a few minutes.                            │
│                                                 │
│         [ Try Again ]                          │
```

---

### Step 1 — Convert generate route to SSE

route.ts — return `ReadableStream` with `Content-Type: text/event-stream` instead of `NextResponse.json`.

A helper `send(ctrl, data)` writes `data: ${JSON.stringify(data)}\n\n` to the stream controller.

**5 real SSE steps** (mapping directly to what the backend actually does):

| Step key | Emitted when |
|---|---|
| `profile` → done | After reading trip + prompt from DB |
| `ai` → active | Just before `generateJSON()` call |
| `ai` → done | After `generateJSON()` returns |
| `schedule` → done | After days + items bulk-inserted into DB |
| `cards` → active | Before `Promise.allSettled` card loop |
| `cards` → done | After card loop completes |
| `finalise` → done | After `trip.status = 'active'` |
| `complete` | Final event — `{ days: N, cards: N }` |
| `error` | Any `catch` — `{ message: "Something went wrong…" }` |

All pre-stream errors (401, 404, 409, 503) remain as plain JSON responses so the client can handle them before starting to read the stream.

---

### Step 2 — Create `GenerationProgressModal.tsx`

**Props:**
```ts
{
  isOpen: boolean
  trip: {
    destination: string; country: string
    startDate: string; endDate: string
    travelStyle: string; groupType: string
    budgetRange: string; pacing: string
    coverImageUrl: string | null
  }
  stepStates: Record<string, 'pending' | 'active' | 'done'>
  progress: number   // 0–100 overall
  result: { days: number; cards: number } | null
  error: string | null
  onDone: () => void  // calls router.refresh() + closes
}
```

**Rotating tips** (static array of 6, fade every 4s via `useEffect` + `setInterval`):
> "Mornings are best for popular attractions — fewer crowds, softer light."  
> "Great itineraries mix iconic landmarks with hidden local gems."  
> "Building in free afternoons prevents decision fatigue while travelling."  
> "Budget a flex fund of 15% for spontaneous discoveries."  
> "The best meals are rarely at the most famous restaurants."  
> "Walking between spots reveals the city's real character."

**Step dot icons:**
`travel_explore` · `auto_awesome` · `save` · `location_on` · `check_circle`

**Overall progress** = `(doneCount / 5) * 100` — updates in real time as SSE events arrive.

**Backdrop:** `fixed inset-0 bg-black/60 backdrop-blur-sm z-50` — non-dismissable during generation.

---

### Step 3 — Update GenerateItineraryButton.tsx

New props: `{ tripId: string, trip: TripInfo }`

Replaces the fetch-and-await pattern with **SSE stream reading**:
```
fetch → res.body.getReader() → decode chunks → buffer partial lines → parse data: {…} lines → dispatch to stepStates
```

Handles `complete` event → sets result state.  
Handles `error` event → sets error state.  
Removes all existing inline progress bar JSX. Renders `<GenerationProgressModal>`.

---

### Step 4 — Update `trips/[id]/page.tsx`

Line 192: pass full `trip` shape to `<GenerateItineraryButton>`.

---

### Verification
1. Click Generate → modal opens, step 1 turns done immediately, step 2 shows spinner
2. Server AI call completes → steps 3-5 turn done in sequence
3. Completion state: stats + "View My Itinerary" CTA → `router.refresh()` + modal closes
4. Simulate error (wrong API key) → friendly message, no red styling, "Try Again" re-enables button
5. `npx tsc --noEmit` → 0 errors

