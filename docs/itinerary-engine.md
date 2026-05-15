# Itinerary Engine Blueprint

> Draft location in repo: `docs/itinerary-engine-blueprint.md`

## Purpose

Define a psychologically informed itinerary engine for short leisure city trips (2–4 days) that:

- Maximizes subjective satisfaction and memorable moments.
- Avoids decision fatigue, museum fatigue, and over‑scheduling.
- Produces a predictable day structure that is easy to render in the RouteCrafted UI on web and mobile.[file:6][web:35][web:12]

This blueprint combines research on decision fatigue, chronobiology, museum fatigue, and the peak–end rule with RouteCrafted’s existing flows (trip form, pacing selector, weather‑aware rewrites, and worth‑it / skip‑it cards).[file:6][web:25][web:35]

---

## Key concepts

### Entities visible to the traveler

- **Anchor activity**  
  High‑value, planned experience with some logistical rigidity (timed entry, tour, must‑see sight, special dinner).

- **Soft activity**  
  Low‑stakes, flexible experience (neighborhood walk, market, casual bar, street food area).

- **Buffer block**  
  Explicit white‑space segments for walking, resting, or unstructured exploration (e.g., "Café break", "Park pause").

- **Flex choice block**  
  A time window with 2–3 curated options displayed as cards; traveler can pick one, pick later, or skip.

- **Peak**  
  One intentionally highlighted moment per day that is likely to be emotionally strong and memorable (sunset viewpoint, special dinner, show).[web:25]

- **Wind‑down segment**  
  Final low‑stress part of the day (short walk near lodging, dessert, quiet bar) designed to end on a positive note.[web:25][web:31]

These concepts must be visible in the UI as labels or badges so travelers can understand the structure at a glance.

---

## Day structure model

### Default wake window template

Assume a typical wake window of approximately 08:00–23:00, adjustable per user and season.[web:10][web:19]

| Block | Approx. time | Role | Typical content |
|-------|--------------|------|-----------------|
| Ease‑in | 08:00–09:30 | Gentle start | Breakfast near lodging, short walk |
| Morning focus | 09:30–12:30 | High‑focus | Main cultural anchor (museum, walking tour) |
| Midday recovery | 12:30–14:30 | Rest + logistics | Lunch, park, market, transit |
| Afternoon light | 14:30–17:00 | Optional focus | Second anchor or soft activity |
| Golden‑hour peak | 17:00–20:00 | Emotional high | Viewpoint, standout meal, special event |
| Wind‑down | 20:00–23:00 | Calm close | Nearby stroll, dessert, bar |

Psychology‑driven constraints:

- At most **2 museums / heavy indoor cultural sites per day**, separated by at least 2 hours and a change of context.[web:35][web:23]
- No more than **90 minutes of continuous high‑cognitive activity** without a 15–30 minute lower‑load block.[web:35]
- Ensure **at least one low‑commitment flex block** per day so travelers can decide in the moment and preserve autonomy.[web:12]
- Reserve the **final slot** for low‑risk activities near lodging to leverage the peak–end rule and avoid stressful endings.[web:25][web:31]

### Pacing modes

Use pacing to tune counts and thresholds per day.

| Dimension | Relaxed | Moderate | Packed |
|----------|---------|----------|--------|
| Anchors/day | 1–2 | 2–3 | 3–4 |
| Max museums/day | 1 | 2 | 3 (show fatigue warning) |
| Planned walking | ~4–7 km | ~6–10 km | ~8–14 km |
| White‑space blocks | 3–4 | 2–3 | 1–2 |

These values map to the existing `pacing` field in the trip creation form.[file:6]

---

## Algorithm outline

### Inputs

Per trip:

- Destination, dates.
- Budget, group type, travel style, pacing (from create‑trip form).[file:6]
- Optional: declared chronotype ("I’m a morning person" / "I prefer late starts").

Per place/activity:

- Category (museum, viewpoint, restaurant, bar, market, neighborhood, park, tour…).
- Tags: cognitive load (low/medium/high), physical load, emotional intensity, logistical rigidity (fixed time vs anytime).[web:23][web:29]
- Estimated duration and recommended time‑of‑day windows.
- Location (for clustering and walking estimation).

### Steps

1. **Generate candidate set** of activities matching destination, style, budget, and group type.
2. **Cluster by geography** to form day‑level and block‑level candidates, minimizing back‑tracking.
3. **Assign anchors**:
   - Pick 2–3 candidate anchors per day using style/pacing.
   - Place cognitively heavy anchors into morning focus block when possible.[web:10][web:19]
4. **Assign peak**:
   - Choose one high‑emotion anchor or soft activity per day.
   - Prefer slots in golden‑hour block (17:00–20:00).
5. **Fill soft + buffer blocks**:
   - Add low‑load activities around anchors to reach target walking and variety constraints.
   - Insert explicit buffer segments between high‑load spans.
6. **Add flex blocks**:
   - Create at least one flex choice per day populated with 2–3 options near where the traveler will be.
7. **Validate constraints**:
   - Check museums/day, continuous load, walking distance, and last‑slot safety.
   - If violated, downgrade or move anchors; else mark day as "balanced".
8. **Expose explanation metadata** to the UI (e.g., `peak: true`, `flexBlockId`, `loadScore`) for tooltips and labels.

---

## UX wireframe notes

### 1. Trip overview (web and mobile)

**Goal:** High‑level clarity about how each day feels before diving into details.

Layout (web):

- Left column: list of days as cards, one per row.
- Each day card shows:
  - Date and a short title (e.g., "Old Town + Riverfront"), generated from main neighborhood/anchors.
  - Badges: `Balanced`, `High energy`, `Mostly walking`, `Relaxed` based on pacing and load calculations.
  - Mini timeline chips: icons for anchors (⭐), flex blocks (⬀), and peaks (📍) in sequence.
- Clicking a day card opens the **Day detail** view.

Layout (mobile):

- Vertical scroll list of day cards with the same badges and chips but fewer words.
- Tap to open Day detail.

### 2. Day detail timeline

**Goal:** Make the psychological structure tangible: blocks, peaks, flex, and buffers are clearly visible.

General structure:

- Vertical timeline from morning to night, segmented into the six standard blocks (Ease‑in, Morning focus, etc.).
- Each block is a horizontal card spanning the width of the screen with:
  - Block label (e.g., "Morning focus").
  - Time range (editable by user).
  - One or more **activity cards** inside.

Activity card contents:

- Title, thumbnail, and short reason to go (from worth‑it / skip‑it summary).
- Tags: `Anchor`, `Soft`, `Flex option`, `Peak`, `Buffer`.
- Duration badge (e.g., `1 h 30`), energy/effort icons, and approximate cost band.[file:6]

Visual marks:

- **Peak badge** (e.g., gold star) on the chosen peak activity card.
- **Flex block** rendered as a card stack:
  - Top card: "Choose later" summary with 2–3 small option thumbnails.
  - Swiping or tapping opens a bottom sheet listing options; selecting one promotes it to the top card.
- **Buffers** labeled clearly ("Walk + café break") with lighter color.

Empty / optional slots:

- If the engine leaves a block mostly free, show a calm placeholder like "Free to explore – here are some ideas" plus 1–3 tappable recommendations.

### 3. Flex choice interaction

Wireframe behavior:

- Flex blocks display as a container with:
  - Heading: "Your choice here".
  - Short text: "Pick one now or decide later – all options are near where you’ll be".
  - Carousel of 2–3 cards:
    - Each card shows name, type icon (e.g., 🍝, 🛶, 🌆), duration, and 1‑line pitch.
- Actions:
  - **Pick option** – sets that activity as the block’s main card.
  - **Decide later** – leaves block as placeholder but pins options so they are one tap away in trip.

The engine should preserve structure even if the traveler ignores a flex block; the day remains valid because buffers and anchors are unchanged.

### 4. Peak and wind‑down presentation

- On Day detail, show a **"Today’s highlight"** banner at the top with the selected peak activity, time, and photo.
- On the timeline, the peak card gets:
  - Stronger color accent.
  - Tooltip: "Designed as your day’s highlight – you can move or change it".
- The final block is visually distinct (softer background) with copy like "End the day gently" and low‑risk suggestions near lodging.

For the **last trip day**, add a subtle note in the final block: "We kept this evening lighter so you can pack and rest" to reflect the underlying psychology.[web:12]

### 5. Weather‑aware rewrites (integration point)

Because RouteCrafted already includes weather‑aware rewrites, integrate them without breaking the day model.[file:6]

Wireframe behavior:

- At the top of Day detail, show a **weather banner** when conditions affect one or more blocks:
  - Example: "Rain expected 14:00–17:00 – we suggest swapping your park visit with tomorrow’s museum."[file:6]
- Within the affected block:
  - Show the old activity card ghosted out.
  - Show a suggested replacement stacked on top, with CTA buttons:
    - `Accept change for this block`.
    - `Keep original`.
- If user accepts, preserve:
  - Peak placement if possible.
  - Count of anchors and buffers for the day.

### 6. Explanation and trust micro‑copy

To help travelers understand why the engine structured the day this way, add lightweight explanations:

- Small info icon near day title opening a bottom sheet:  
  "We limit intense museum time and long walks in one stretch to avoid fatigue and help you enjoy more."[web:35][web:23]
- When users switch to Packed pacing or add extra anchors, show a non‑blocking hint:  
  "This is denser than most travelers prefer – you may feel rushed. Want to see a balanced version?"[web:24][web:27]

---

## Data contract to UI

Expose the following fields from the itinerary engine to clients (web + mobile):

Per day:

- `date`
- `title`
- `pacingMode`
- `loadBadge` (enum: `balanced`, `high_energy`, `relaxed`, `heavy_walking`…)
- `hasWeatherAlert`
- `peakActivityId`

Per block:

- `blockId`
- `label` (e.g., "Morning focus")
- `startTime`, `endTime`
- `type` (enum: `ease_in`, `focus`, `recovery`, `light`, `peak_window`, `wind_down`)

Per activity instance:

- `activityId`
- `kind` (`anchor`, `soft`, `buffer`, `flex_option`)
- `isPeak` (bool)
- `isFlex` (bool)
- `durationMinutes`
- `effortScore` (0–100)
- `costBand`
- `reasonToGo`, `reasonToSkip` (from worth‑it / skip‑it cards).[file:6]

This contract gives the frontend enough structure to render the psychologically informed day without duplicating engine logic.

---

## Implementation checklist

- [ ] Implement activity tagging (cognitive load, physical load, emotional intensity, rigidity).
- [ ] Implement day‑block generator using wake‑window template and pacing rules.
- [ ] Implement peak selection and wind‑down protection.
- [ ] Implement flex blocks with 2–3 curated options and state for chosen option.
- [ ] Enforce hard constraints for museums, continuous cognitive load, and walking distance.[web:35][web:23]
- [ ] Expose explanation metadata and copy keys for UX.
- [ ] Wire up weather‑aware rewrite endpoints so rewrites respect peaks, buffers, and constraints.[file:6]
- [ ] Instrument analytics: anchors completed, flex choices used, user edits per block, satisfaction ratings per day.

Once implemented, these analytics can be used to iteratively refine thresholds (e.g., anchors/day, walking caps) based on real RouteCrafted user behavior.[web:12]
