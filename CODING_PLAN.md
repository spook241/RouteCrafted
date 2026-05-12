@ -1,548 +0,0 @@
# CODING_PLAN.md — RouteCrafted

_Full technical reference for building RouteCrafted. Quick agent guidance is in **[AGENTS.md](./AGENTS.md)**._

---

## 1. Project Goal & MVP Scope

**RouteCrafted** generates practical, day-by-day travel itineraries using AI. It monitors weather forecasts and rewrites affected days automatically, and provides "Worth It / Skip It" decision cards for attractions.

**MVP is complete when:**
- A traveler can register, create a trip, and receive a structured AI itinerary
- Weather alerts surface automatically and a one-click rewrite is offered
- Place cards are generated for attractions in the itinerary
- An admin can manage users and moderate flagged cards
- The web app has ≥5 screens and the mobile app has ≥3 screens, all deployed live

**Capstone course:** Full Stack Apps with AI — SoftUni
**Live URL:** https://RouteCrafted.com

---

## 2. Implementation Phases

Build in this order — each phase is deployable on its own.

| Phase | Deliverables |
|---|---|
| **1 — Foundation** | Monorepo setup (Turborepo + npm workspaces), root `package.json`, `turbo.json`, `packages/shared` types package |
| **2 — Auth + DB** | Neon DB connection, Drizzle schema (users, trips tables), Auth.js credential provider, register + login API routes, JWT session |
| **3 — Trip CRUD** | Trip creation form (web), trips API routes (GET/POST/PATCH/DELETE), Nominatim geocoding on creation, dashboard screen |
| **4 — Itinerary AI** | Gemini 2.0 Flash integration (`lib/ai/gemini.ts`), itinerary_days + itinerary_items tables, `/api/itinerary/generate`, trip detail + day plan screens |
| **5 — Weather** | Open-Meteo integration, weather_alerts table, `/api/weather/check/:tripId`, alert UI on trip detail, rewrite-day endpoint |
| **6 — Place Cards** | OpenTripMap POI enrichment, place_cards table, `/api/places/generate-cards`, Worth It / Skip It card UI, flagging + admin_flags table |
| **7 — Admin + Polish** | Admin panel screen, admin API routes (users, flags, stats), Cloudflare R2 file uploads, Resend email, Expo mobile app (3+ screens), Vercel deployment |

---

## 3. Database Schema

### 3.1 Tables

#### `users`
```ts
id           uuid        PK, default gen_random_uuid()
email        text        unique, not null
passwordHash text        not null
name         text        not null
role         text        'traveler' | 'admin', default 'traveler'
avatarUrl    text        nullable — R2 URL
expoPushToken text       nullable — for mobile push
createdAt    timestamp   default now()
updatedAt    timestamp
```

#### `trips`
```ts
id           uuid        PK
userId       uuid        FK → users.id (cascade delete)
destination  text        city/place name
country      text
lat          numeric     resolved via Nominatim on creation
long         numeric
startDate    date
endDate      date
budgetRange  text        'budget' | 'mid' | 'luxury'
travelStyle  text        'cultural' | 'adventure' | 'relaxation' | 'foodie'
groupType    text        'solo' | 'couple' | 'family' | 'friends'
pacing       text        'relaxed' | 'moderate' | 'packed'
status       text        'draft' | 'active' | 'completed'
coverImageUrl text       nullable — R2 URL
createdAt / updatedAt
```

#### `itinerary_days`
```ts
id             uuid      PK
tripId         uuid      FK → trips.id (cascade delete)
dayNumber      integer   1-based
date           date
theme          text      AI-generated day theme
summary        text      short AI summary
weatherCode    integer   nullable — Open-Meteo WMO code
weatherLabel   text      nullable — human-readable
weatherAlerted boolean   default false
rewrittenAt    timestamp nullable
createdAt / updatedAt
```

#### `itinerary_items`
```ts
id            uuid       PK
dayId         uuid       FK → itinerary_days.id (cascade delete)
position      integer    order within the day
timeBlock     text       'morning' | 'afternoon' | 'evening'
type          text       'activity' | 'meal' | 'transport'
title         text
description   text
location      text       place name or address
durationMins  integer
estimatedCost numeric    in USD
isOptional    boolean    default false
placeCardId   uuid       nullable FK → place_cards.id
createdAt / updatedAt
```

#### `place_cards`
```ts
id            uuid       PK
tripId        uuid       FK → trips.id
name          text
category      text       'museum' | 'restaurant' | 'park' | ...
verdict       text       'worth_it' | 'skip_it' | 'depends'
summary       text       AI one-liner
worthItReasons  jsonb    string[]
skipItReasons   jsonb    string[]
bestFor       text       traveler-type description
costLevel     text       'free' | 'low' | 'medium' | 'high'
timeNeeded    text       e.g. "1–2 hours"
lat / long    numeric    nullable
imageUrl      text       nullable — R2 or OpenTripMap image
flagged       boolean    default false
flagReason    text       nullable
createdAt / updatedAt
```

#### `weather_alerts`
```ts
id              uuid     PK
tripId          uuid     FK → trips.id
dayId           uuid     FK → itinerary_days.id
alertType       text     'rain' | 'storm' | 'extreme_heat' | 'snow'
forecastCode    integer  Open-Meteo WMO code
alertedAt       timestamp
dismissed       boolean  default false
rewriteAccepted boolean  default false
```

#### `admin_flags`
```ts
id           uuid       PK
placeCardId  uuid       FK → place_cards.id
raisedBy     uuid       FK → users.id
reason       text
status       text       'open' | 'resolved' | 'dismissed'
resolvedBy   uuid       nullable FK → users.id
createdAt / updatedAt
```

### 3.2 Relationships
```
users ──< trips ──< itinerary_days ──< itinerary_items
                └─< place_cards ──< admin_flags
                └─< weather_alerts
```

### 3.3 Migration Rules
- Schema file: `apps/web/lib/db/schema.ts`
- Always run `npx drizzle-kit generate` then `npx drizzle-kit migrate` from `apps/web/`
- Commit all files in `apps/web/drizzle/` — required by capstone assessment
- Never modify an already-applied migration file

---

## 4. API Endpoint Catalogue

All routes live in `apps/web/app/api/`. JWT required = checked via `auth()` from Auth.js.

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user, hash password with bcrypt |
| POST | `/api/auth/[...nextauth]` | — | Auth.js handler (login, logout, session) |
| GET | `/api/auth/me` | JWT | Current user profile |

### Trips
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/trips` | JWT | List authenticated user's trips |
| POST | `/api/trips` | JWT | Create trip; geocode destination via Nominatim |
| GET | `/api/trips/:id` | JWT | Trip with all days, items, place cards |
| PATCH | `/api/trips/:id` | JWT | Update trip metadata |
| DELETE | `/api/trips/:id` | JWT | Delete trip and all related data (cascade) |

### Itinerary
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/itinerary/generate` | JWT | Generate full itinerary via OpenRouter; store days + items |
| POST | `/api/itinerary/rewrite-day` | JWT | Rewrite one day (weather or manual) via OpenRouter |
| PATCH | `/api/itinerary/items/:id` | JWT | Edit a single itinerary item |
| DELETE | `/api/itinerary/items/:id` | JWT | Remove a single itinerary item |

### Place Cards
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/places/generate-cards` | JWT | Generate worth-it/skip-it cards via OpenRouter + OpenTripMap |
| GET | `/api/places/cards/:tripId` | JWT | List all place cards for a trip |
| GET | `/api/places/cards/item/:id` | JWT | Single place card |
| POST | `/api/places/flag/:id` | JWT | Flag a card as inaccurate |

### Weather
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/weather/check/:tripId` | JWT | Fetch forecast from Open-Meteo; create alerts if changed |
| POST | `/api/weather/dismiss/:alertId` | JWT | Dismiss a weather alert |

### Uploads
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/upload/avatar` | JWT | Upload profile photo → R2; return URL |
| POST | `/api/upload/trip-cover` | JWT | Upload trip cover image → R2; return URL |

### Admin (role: admin required)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | Paginated user list |
| PATCH | `/api/admin/users/:id` | Admin | Edit role or suspend user |
| GET | `/api/admin/flags` | Admin | Open moderation flags |
| PATCH | `/api/admin/flags/:id` | Admin | Resolve or dismiss a flag |
| DELETE | `/api/admin/cards/:id` | Admin | Remove a flagged place card |
| GET | `/api/admin/stats` | Admin | Platform usage statistics |

---

## 5. Web Screens

| # | Route | Description | Key Components |
|---|---|---|---|
| 1 | `/` | Landing — hero, features, CTAs | `HeroSection`, `FeatureGrid`, `CTAButton` |
| 2 | `/register` | Sign-up form | `RegisterForm` (client component) |
| 3 | `/login` | Sign-in form | `LoginForm` (client component) |
| 4 | `/dashboard` | My Trips list + create CTA | `TripCard`, `CreateTripButton` |
| 5 | `/trips/new` | Trip creation form | `TripForm` with Mapbox autocomplete |
| 6 | `/trips/:id` | Trip detail — days, weather, cards | `DayList`, `WeatherAlert`, `PlaceCardGrid` |
| 7 | `/trips/:id/day/:dayNumber` | Day plan — time blocks, edit/regenerate | `TimeBlock`, `ItineraryItem`, `RegenerateButton` |
| 8 | `/admin` | Admin panel — users, flags, stats | `UserTable`, `FlagQueue`, `StatsPanel` |
| 9 | `/profile` | Settings, avatar upload | `ProfileForm`, `AvatarUpload` |

---

## 6. Mobile Screens

| # | File | Description |
|---|---|---|
| 1 | `app/(tabs)/index.tsx` | My Trips — trip cards list |
| 2 | `app/trip/[id].tsx` | Day Plan — time blocks + weather badge |
| 3 | `app/card/[id].tsx` | Place Card detail — verdict, reasons, cost, time |
| 4 | `app/(tabs)/profile.tsx` | User settings and preferences |
| 5 | `app/(tabs)/explore.tsx` | (Optional) Featured destinations |

Mobile communicates **only** via the Next.js REST API (`apps/mobile/lib/api.ts`).

---

## 7. AI Feature Prompts

All prompts are assembled and called in `apps/web/lib/ai/openrouter.ts`. Always request `response_format: { type: "json_object" }` and validate the result with Zod before writing to DB.

### 7.1 Itinerary Generation

**Input:**
```ts
{
  destination: string,
  country: string,
  startDate: string,    // ISO date
  endDate: string,
  budgetRange: 'budget' | 'mid' | 'luxury',
  travelStyle: 'cultural' | 'adventure' | 'relaxation' | 'foodie',
  groupType: 'solo' | 'couple' | 'family' | 'friends',
  pacing: 'relaxed' | 'moderate' | 'packed'
}
```

**Expected output** (array of days):
```jsonc
[
  {
    "dayNumber": 1,
    "date": "2024-06-01",
    "theme": "Historic Old Town",
    "summary": "Start with the cathedral and end at the night market.",
    "items": [
      {
        "timeBlock": "morning",
        "type": "activity",
        "title": "Cathedral of Santa Maria",
        "description": "...",
        "location": "Plaza Mayor 1",
        "durationMins": 90,
        "estimatedCost": 12,
        "isOptional": false
      }
    ]
  }
]
```

### 7.2 Weather Day Rewrite

**Input:**
```ts
{
  day: { theme, date, items[] },
  forecastCode: number,    // Open-Meteo WMO code
  weatherLabel: string     // e.g. "Heavy rain"
}
```

**Expected output:** Same day structure with updated items that work under the forecast conditions.

### 7.3 Place Card (Worth It / Skip It)

**Input:**
```ts
{
  placeName: string,
  category: string,
  location: string,
  travelStyle: string,
  groupType: string
}
```

**Expected output:**
```jsonc
{
  "verdict": "worth_it",
  "summary": "Unmissable for culture lovers — skip on weekends.",
  "worthItReasons": ["World-class collection", "Free entry on Thursdays"],
  "skipItReasons": ["Packed on weekends", "No English signage"],
  "bestFor": "Solo cultural traveler",
  "costLevel": "low",
  "timeNeeded": "1–2 hours"
}
```

---

## 8. External Integrations

### 8.1 OpenRouter (Primary LLM)
_All calls through `apps/web/lib/ai/openrouter.ts`_
```ts
import OpenAI from "openai"
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://routecrafted.com",
    "X-Title": "RouteCrafted",
  },
})

export async function generateJSON<T>(prompt: string): Promise<T> {
  const completion = await openrouter.chat.completions.create({
    model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  })
  return JSON.parse(completion.choices[0].message.content!) as T
}
```
Free credits on signup; many open models available at $0 cost. Swap the model via `OPENROUTER_MODEL` env var.

### 8.2 Groq (Fallback LLM)
_Use as a low-latency fallback for streaming responses or when OpenRouter rate limits apply_
```ts
import Groq from "groq-sdk"
const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
const completion = await client.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [{ role: "user", content: prompt }],
  response_format: { type: "json_object" }
})
```
Free tier: 14,400 requests/day.

### 8.3 Open-Meteo (Weather — no API key)
_All calls through `apps/web/lib/weather/open-meteo.ts`_
```ts
const url = `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${lat}&longitude=${lon}` +
  `&daily=weathercode,temperature_2m_max,precipitation_probability_max` +
  `&forecast_days=7`
const res = await fetch(url)
const data = await res.json()
// data.daily.weathercode[i] — WMO code for each forecast day
```

### 8.4 Nominatim (Server-side geocoding — no API key)
```ts
const res = await fetch(
  `https://nominatim.openstreetmap.org/search` +
  `?q=${encodeURIComponent(destination)}&format=json&limit=1`,
  { headers: { "User-Agent": "RouteCrafted/1.0" } }  // required by TOS
)
const [place] = await res.json()
// place.lat, place.lon
```

### 8.5 Mapbox (Client-side destination autocomplete)
Use `@mapbox/search-js-react` in the trip creation form.
Token: `NEXT_PUBLIC_MAPBOX_TOKEN` env var (only public env var exposed to browser).

### 8.6 OpenTripMap (POI enrichment for place cards)
_All calls through `apps/web/lib/places/opentripmap.ts`_
```ts
// Get POIs near coordinates
const res = await fetch(
  `https://api.opentripmap.com/0.1/en/places/radius` +
  `?radius=1000&lon=${lon}&lat=${lat}&apikey=${process.env.OPENTRIPMAP_KEY}`
)
```

### 8.7 Cloudflare R2 (Object storage)
_All uploads through `apps/web/lib/storage/r2.ts`_
```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
await client.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME!,
  Key: `avatars/${userId}.jpg`,
  Body: buffer,
  ContentType: "image/jpeg",
}))
```
Free tier: 10 GB storage, 1M writes/month, no egress fees.

### 8.8 Auth.js (Authentication)
_Config at `apps/web/app/api/auth/[...nextauth]/route.ts`_
```ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
export const { handlers, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async ({ email, password }) => {
        const user = await getUserByEmail(email as string)
        if (!user || !await bcrypt.compare(password as string, user.passwordHash)) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: ({ token, user }) => { if (user) token.role = (user as any).role; return token },
    session: ({ session, token }) => { session.user.role = token.role as string; return session }
  }
})
export const { GET, POST } = handlers
```

### 8.9 Resend (Email)
_All sending through `apps/web/lib/email/resend.ts`_
```ts
import { Resend } from "resend"
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: "RouteCrafted <noreply@routecrafted.com>",
  to: user.email,
  subject: "Your itinerary is ready",
  react: <ItineraryReadyEmail trip={trip} />,  // React Email template
})
```
Templates live in `apps/web/emails/`. Free tier: 3,000 emails/month.

### 8.10 Expo Push Notifications
_Sending through `apps/web/lib/notifications/expo-push.ts`_
```ts
await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: user.expoPushToken,
    title: "Weather alert",
    body: "Rain expected tomorrow — tap to see replan options.",
    data: { tripId, dayId }
  }),
})
```

---

## 9. Environment Variables

Create `apps/web/.env.local` — never commit this file.

```bash
# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Auth.js
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# AI
OPENROUTER_API_KEY=       # https://openrouter.ai
OPENROUTER_MODEL=deepseek/deepseek-chat  # any model slug from openrouter.ai/models
GROQ_API_KEY=             # https://console.groq.com (fallback)

# Geocoding (client-side autocomplete only)
NEXT_PUBLIC_MAPBOX_TOKEN= # https://mapbox.com — only public env var

# Places / POI
OPENTRIPMAP_KEY=          # https://dev.opentripmap.org

# Cloudflare R2 storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=routecrafted-uploads

# Email
RESEND_API_KEY=           # https://resend.com

# Open-Meteo has no key — omit
```

> `NEXT_PUBLIC_MAPBOX_TOKEN` is the only env var that may be exposed to the browser.
> All others must remain server-side only.

---

## 10. Capstone Checklist

| Criterion | Points | Implementation target |
|---|---|---|
| GitHub Commits (≥15) | 0–15 | 1 commit per meaningful change; commit each phase |
| Commit Days (≥3 different days) | 0–15 | Spread work across the 7 phases |
| Architecture | 0–5 | Turborepo monorepo, `apps/web` + `apps/mobile`, REST API |
| Backend API | 0–7 | All routes in section 4, JWT on protected routes |
| Database (≥4 tables) | 0–8 | 7 tables in section 3; Drizzle migrations committed |
| Auth & Security | 0–5 | `auth()` guard, role check server-side, no secrets in client |
| Web Screens (≥5) | 0–10 | 9 screens in section 5, responsive Tailwind design |
| Admin Panel | 0–10 | `/admin` screen + `/api/admin/*` routes, role-gated |
| Mobile App (≥3 screens) | 0–9 | Expo app, 5 screens in section 6, REST API client |
| Deployment | 0–10 | Vercel (web), Expo (mobile), Neon (DB), live URL |
| Documentation | 0–6 | README, AGENTS.md, CODING_PLAN.md, schema diagram |
| **Total** | **100** | |