# RouteCrafted — Local Development Manual

## Prerequisites

- **Node.js** >= 18
- **npm** >= 10
- A **Neon** (or any PostgreSQL) database
- A **Cloudflare R2** bucket (for image uploads)
- An **OpenRouter** API key (for AI itinerary generation)
- An **OpenTripMap** API key (for place cards)
- A **Resend** API key (for emails) — optional for local dev

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd RouteCrafted
npm install
```

This installs dependencies for all workspaces (`apps/web`, `apps/mobile`, `packages/shared`) via Turborepo.

---

## 2. Environment Variables

### Web app — `apps/web/.env.local`

Create the file `apps/web/.env.local` with the following:

```env
# ── Database (Neon / PostgreSQL) ──────────────────────────────────────
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require

# ── Auth (NextAuth v5) ────────────────────────────────────────────────
AUTH_SECRET=your-random-secret-min-32-chars
# Generate one with: openssl rand -base64 32

# ── AI (OpenRouter) ───────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-chat   # optional, this is the default

# ── Places (OpenTripMap) ──────────────────────────────────────────────
OPENTRIPMAP_KEY=your-opentripmap-api-key

# ── Storage (Cloudflare R2) ───────────────────────────────────────────
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=routecrafted-uploads       # optional, this is the default
R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # public domain for your bucket

# ── Email (Resend) ────────────────────────────────────────────────────
RESEND_API_KEY=re_...                     # optional for local dev
```

### Mobile app — `apps/mobile/.env.local`

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> On a physical device replace `localhost` with your machine's local IP, e.g. `http://192.168.1.x:3000`.

---

## 3. Database Setup

### Push schema (first-time or after schema changes)

```bash
cd apps/web
npx drizzle-kit push
```

### (Optional) Run migrations instead

```bash
cd apps/web
npx drizzle-kit migrate
```

### Seed the admin user

```bash
cd apps/web
ADMIN_PASSWORD=yourpassword npx tsx scripts/seed-admin.ts
```

Default credentials after seeding:
- **Email**: `admin@routecrafted.com`
- **Password**: whatever you set for `ADMIN_PASSWORD`

You can override the email/name:

```bash
ADMIN_EMAIL=me@example.com ADMIN_NAME="My Name" ADMIN_PASSWORD=secret npx tsx scripts/seed-admin.ts
```

---

## 4. Running the Apps

### Run everything at once (recommended)

From the repo root:

```bash
npm run dev
```

This uses Turborepo to start all apps in parallel.

### Run web only

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run mobile only

```bash
cd apps/mobile
npm run dev
```

Scan the QR code with **Expo Go** (iOS/Android) or press:
- `w` — open in web browser
- `a` — open Android emulator
- `i` — open iOS simulator

---

## 5. Key Routes

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Landing page |
| `http://localhost:3000/login` | Sign in |
| `http://localhost:3000/register` | Create account |
| `http://localhost:3000/dashboard` | User dashboard (protected) |
| `http://localhost:3000/trips/new` | Create a trip (protected) |
| `http://localhost:3000/admin` | Admin panel (admin role required) |

---

## 6. Build for Production

```bash
# Web
cd apps/web
npm run build
npm run start

# Or from root
npm run build
```

---

## 7. Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in dev mode |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npx drizzle-kit push` | Sync schema to DB (run from `apps/web`) |
| `npx drizzle-kit studio` | Open Drizzle Studio DB browser (run from `apps/web`) |
| `npx tsx scripts/seed-admin.ts` | Seed admin user (run from `apps/web`) |
