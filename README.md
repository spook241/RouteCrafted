# RouteCrafted

> Smart AI-powered travel itinerary builder — demo: https://www.routecrafted.com

RouteCrafted is a multi-platform full-stack project that generates practical, day-by-day travel itineraries and keeps them useful by reacting to live signals (weather, availability). This README documents the architecture, integrations, developer setup, and where features live in the repo.

---

## Summary

- Purpose: Generate mobile-first, weather-aware travel itineraries and provide "Worth It / Skip It" decision cards for trip items.
- Audience: Leisure travelers (mobile-first), and site administrators who moderate content and manage platform settings.

---

## Architecture & Monorepo Layout

This repository is a Turbo (monorepo) Node/TypeScript project with two main apps and shared types:

- `apps/web/` — Next.js 15 app (Server & App Router) with backend API routes and admin UI.
- `apps/mobile/` — Expo (React Native Web) mobile client that runs on mobile.web and native devices.
- `packages/shared/` — Shared TypeScript types used across apps.

Key directories:

- apps/web/lib/ai — AI integration wrapper (`openrouter.ts`)
- apps/web/lib/db — Drizzle ORM client and schema definitions (`schema.ts`)
- apps/web/proxy.ts — CORS/proxy handling for mobile clients
- apps/mobile/lib/api.ts — central fetch helper for the mobile client

---

## Tech Stack

- Frameworks: Next.js 15 (App Router), Expo (React Native Web)
- Language: TypeScript
- Runtime & Tooling: Node.js, Turbo, Vercel (hosting)
- Database: PostgreSQL (Neon) via Drizzle ORM and generated migrations (apps/web/drizzle/*)
- Auth: NextAuth / custom mobile JWTs (signed with `NEXTAUTH_SECRET` / `jose` helpers)
- AI: OpenRouter / Gemini (calls consolidated under `apps/web/lib/ai/openrouter.ts`)
- Weather: Open-Meteo (server-side forecasts)
- Storage: Cloudflare R2 for uploads
- Email: Resend (transactional emails)
- Push Notifications: Expo push via `apps/web/lib/notifications/expo-push.ts`

---

## Integrations & APIs

- OpenRouter / Gemini: central AI generation for itineraries, cards, captions.
- Open-Meteo: weather forecasts used for replanning and scoring itinerary days.
- Cloudflare R2: media storage and upload handling via `/api/upload` and R2 helper.
- Resend: sending transactional emails (signups, verify, etc.).
- Expo Push: storing/updating `expoPushToken` via mobile API and sending push notifications from server.

Server-side helpers and integration entry points are under `apps/web/lib/`.

---

## What the User Sees & Can Do

- Sign up / Sign in (JWT-backed session for web; mobile uses token stored in SecureStore/localStorage).
- Create trips: input destination, dates, preferences, and generate AI itineraries.
- View day-by-day plans, edit items, regenerate single days or the whole trip.
- Mobile-first "Worth It / Skip It" cards for quick on-the-ground decisions.
- Save & share trips.

---

## What Admins Can Do

- Access the admin area (guarded by server-side `auth()` and `session.user.role === 'admin'`).
- Moderate user-generated content and itinerary items.
- Manage platform settings stored in `ai_settings` (used for site captions or small text values).
- View usage metrics and perform content edits (planned: editable "Trending right now" caption persisted to DB).

Note: Some admin endpoints and UI pages are planned but may be in-progress (check `apps/web/app/admin/`).

---

## Important Code Locations

- Mobile API helper: `apps/mobile/lib/api.ts`
- Mobile auth: `apps/mobile/lib/auth.tsx`
- Web API proxy/CORS: `apps/web/proxy.ts`
- DB schema & Drizzle migrations: `apps/web/lib/db/schema.ts` and `apps/web/drizzle/`
- AI helpers: `apps/web/lib/ai/openrouter.ts`

---

## Environment Variables (common)

The app uses several environment variables for local development and production. Key names used in the repo:

- `DATABASE_URL` — PostgreSQL connection (Neon)
- `NEXTAUTH_SECRET` — secret used for session signing and mobile JWT verification
- `EXPO_PUBLIC_API_URL` — mobile client base URL (must point to the web API in production)
- `GEMINI_API_KEY` / `OPENROUTER_API_KEY` — AI provider keys
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 credentials
- `RESEND_API_KEY` — transactional email
- `VERCEL_*` — Vercel runtime vars where appropriate

Always avoid committing `.env.local` or any secret files.

---

## Local Development

Prerequisites:

- Node.js (recommended active LTS)
- pnpm or npm
- PostgreSQL (or a Neon dev instance)

Common commands:

```bash
# monorepo dev (runs web + mobile)
npx turbo dev

# just web (Next.js)
cd apps/web && npx turbo dev --filter=web

# mobile (Expo web + native)
cd apps/mobile && ELECTRON_NO_SANDBOX=1 npx expo start --web --port 8081
```

Database migrations (when you change schema):

```bash
cd apps/web
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Deployment

- Web: deploy `apps/web` to Vercel (App Router, serverless functions). Ensure `DATABASE_URL`, `NEXTAUTH_SECRET`, and third-party API keys are set on Vercel.
- Mobile: `apps/mobile` can be hosted as a static web site (React Native Web via Expo) and native builds via Expo Application Services.

---

## Database & Settings Persistence

Site-level small settings live in the `ai_settings` table (Drizzle schema). This is used for things like homepage captions (the project is moving from env-based captions to DB-stored captions editable by admins).

If you want to add or change a global setting programmatically, check `apps/web/lib/db/` helpers and the `ai_settings` schema.

---

## Contributing

- Follow the monorepo conventions: TypeScript strict mode, keep shared types in `packages/shared`.
- Run linters and tests with `npx turbo lint` and the existing workspace commands.
- For DB schema changes: always run `npx drizzle-kit generate` and `npx drizzle-kit migrate` from `apps/web` and commit generated migrations.

---

## Current Status & Roadmap

- Core itinerary generation, weather-aware replanning, and mobile decision cards are implemented.
- Mobile client fetch helper (`EXPO_PUBLIC_API_URL` usage) and token handling are present; ensure production envs are configured to avoid `Failed to fetch` errors.
- Planned/next items:
	- Persist "Trending right now" caption in DB and add admin UI to edit it (`apps/web/app/admin/trending-caption`).
	- Harden some admin APIs and add end-to-end tests.

---

## Where to look next (quick pointers)

- Mobile client entry & auth: `apps/mobile/app/` and `apps/mobile/lib/auth.tsx`
- Web API routes and admin pages: `apps/web/app/api/` and `apps/web/app/admin/`
- Drizzle schema & migrations: `apps/web/lib/db/schema.ts` and `apps/web/drizzle/`

---

If you'd like, I can now:

- Implement the Admin API and UI to persist the "Trending right now" caption into the DB.
- Add a small `getSetting` / `setSetting` helper in `apps/web/lib/db` and wire the homepage to read it server-side.

---

Maintainers & contact

- Project owner: RouteCrafted capstone team (see repo commit history for authors)

