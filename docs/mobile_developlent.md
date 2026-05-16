
---

## Plan: Mobile App — 6 Screens + Web-Matched Design + Responsive Layout

The web app uses a **light Material Design 3** system (white cards, `#0058be` blue primary, horizon gradient CTAs, 24px border-radius). The mobile app currently has a dark navy theme with no component separation. This plan migrates mobile to match the web's visual language, adds a new screen, and makes everything tablet-responsive.

---

### Phase 1 — Foundation *(parallel)*

1. **Install `expo-linear-gradient`** in mobile — needed to replicate the web's `#0058be → #2170e4` horizon gradient on primary buttons
2. **Create `apps/mobile/lib/theme.ts`** — single source of truth for all colors, shadows, border radii, and spacing; copied directly from the web's CSS tokens:
   - `primary: #0058be`, `surface: #f9f9ff`, `onSurface: #111c2d`, `outlineVariant: #c2c6d6`, `error: #ba1a1a`, etc.
   - `cardShadow` style object
3. **Create `apps/mobile/lib/responsive.ts`** — `useResponsive()` hook wrapping `useWindowDimensions`:
   - `isTablet` (width ≥ 768), `numColumns` (2 / 1), `containerPadding`, `cardWidth(cols)`

---

### Phase 2 — Reusable UI Components *(parallel, depends on Phase 1)*

4. `components/ui/GradientButton.tsx` — LinearGradient pill, `loading` spinner, icon slot
5. `components/ui/Badge.tsx` — Status badges (draft/active/completed) + verdict badges (worth_it/skip_it/depends)
6. `components/ui/TripCard.tsx` — White card, `borderRadius:24`, shadow, destination + date + `<Badge>`
7. `components/ui/DayCard.tsx` — Day header + weather row + items list, touch items with `placeCardId` navigate to card
8. `components/ui/PlaceCardItem.tsx` — Compact card: place name + verdict badge + category + chevron
9. `components/ui/Avatar.tsx` — Initials circle, `size` prop (sm/md/lg), gradient ring

---

### Phase 3 — Screen Redesigns *(depends on Phase 2)*

10. **Login** — Light `#f9f9ff` bg, gradient logo mark, web-style bordered inputs, `<GradientButton>` "Sign In", "Sign up on the web" text link
11. **Trips List** (`(tabs)/index`) — `FlatList` of `<TripCard>`, `numColumns` = 1 phone / 2 tablet, light `surfaceContainerLow` page bg
12. **Profile** (`(tabs)/profile`) — `<Avatar size="lg">`, info card with email/role/member-since rows, outlined red logout button
13. **Trip Detail** (`/trip/[id]`) — Destination hero, status badge, notes card, `<DayCard>` per day, "Place Cards" button → navigates to new screen
14. **Place Card Detail** (`/card/[id]`) — Verdict gradient banner, summary card, `✓`/`✗` reason bullets
15. **NEW: Place Cards List** (`/cards/[tripId]`) — Fetch `/api/mobile/cards/[tripId]`, filter pills (All / Worth It / Skip It), `FlatList` of `<PlaceCardItem>`, 1/2 columns

---

### Phase 4 — Navigation *(depends on Phase 3)*

16. **`(tabs)/_layout.tsx`** — Light tab bar (`white` bg, `outlineVariant` border, `primary` active tint, white header)
17. **_layout.tsx** — Add `<Stack.Screen name="cards/[tripId]">` for the new screen

---

**Relevant files:**
- New: `lib/theme.ts`, `lib/responsive.ts`, `components/ui/*.tsx` (6 files), `app/cards/[tripId].tsx`
- Modified: all 6 existing screen files + _layout.tsx + `(tabs)/_layout.tsx`

**Verification:**
1. `expo start --web` — all 6 screens render without errors
2. Light backgrounds visible on all screens (no dark navy)
3. Gradient button renders on login
4. Trips list shows 2-column grid at tablet width (≥768px in browser)
5. Trip detail "Place Cards" button opens new `/cards/[tripId]` screen
6. `npx tsc --noEmit` in mobile passes

**Scope decisions:**
- **Light theme** — matches web (white/surface-blue)
- **Read-only** — no create/edit on mobile per project rules
- **System fonts** — no custom font loading (Plus Jakarta Sans not needed)
- **expo-linear-gradient** — one new dependency required

---

