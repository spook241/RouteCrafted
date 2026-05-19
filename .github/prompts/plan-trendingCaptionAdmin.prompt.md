Plan: Persist "Trending right now" caption in DB and add admin editing UI

Goal
- Store the homepage "Trending" caption in the database (not env), expose an admin API to read/update it, and add a small admin UI to edit it.

Context
- Project uses Drizzle ORM and already has an `ai_settings` table (key, value, description, updatedBy, updatedAt).
- Home page `apps/web/app/page.tsx` should read caption from DB server-side.
- Admin API must be protected so only users with `role === 'admin'` can update.

Steps
1. Read caption on Home page
   - Add a server-side helper `getSetting(key)` in `apps/web/lib/db/ai-config.ts` (or reuse existing helper if present) returning the `ai_settings` row for `key`.
   - Update `apps/web/app/page.tsx` to call `await getSetting('trending_caption')` and use `row?.value ?? 'Trending right now'` for heading/caption.

2. Add Admin API route
   - Create `apps/web/app/api/admin/trending-caption/route.ts` with `GET` and `PUT` handlers.
   - Protect endpoints via `auth()` (existing auth helper). If no session → 401; if session.user.role !== 'admin' → 403.
   - `GET`: select the `ai_settings` row where `key = 'trending_caption'` and return it (JSON).
   - `PUT`: validate body `{ value: string }`. If row exists → update `value`, `updatedBy`, `updatedAt`; else insert a new row with `key='trending_caption'` and `value` and `updatedBy`.
   - Use Drizzle queries and `eq` from `drizzle-orm`. Return the created/updated row.

3. Admin UI page
   - Add a simple admin page at `apps/web/app/admin/trending-caption/page.tsx` (Server Component or small Client Component with `useState`) that:
     - Fetches current caption from the Admin API (GET) on mount (or server-side render for initial value).
     - Shows a textarea (or input) with the caption and a Save button.
     - On Save: call the Admin API `PUT` with JSON `{ value }` and show success/error.
     - Only render an edit link (or show) when `session.user.role === 'admin'` — can reuse check used in header (server-side `auth()`).

4. Wire homepage Edit link
   - In `apps/web/app/page.tsx`, where caption is shown, show an "Edit" link pointing to `/admin/trending-caption` only if `session?.user?.role === 'admin'` (server-side check already present).

5. Tests & validation
   - Manual checks with `curl` and browser:
     - `GET /api/admin/trending-caption` returns JSON row or null for admins.
     - `PUT /api/admin/trending-caption` updates or inserts row and returns created/updated row.
     - Homepage renders new caption after update (redeploy not required for server-rendered content; it reads DB at request time).
   - Unit/test suggestions: add small integration tests for the API handlers if test infra exists.

6. Security & auditing
   - Ensure `updatedBy` is set to the admin user id on updates.
   - Add DB constraints already exist on `ai_settings.key` unique; reuse that.

7. Deployment notes
   - No DB migration required (table `ai_settings` exists). If not, create a Drizzle migration to add `ai_settings`.
   - No environment changes required for this feature.

Acceptance criteria
- Admins can edit the Trending caption at `/admin/trending-caption`.
- Homepage shows the caption value from DB for all visitors.
- Non-admins cannot access the admin API/UI (403/redirect).
- Audit fields (`updatedBy`, `updatedAt`) are set when changed.

Fallback / Rollback
- If an issue occurs, revert the homepage change to the static default string and remove the admin UI until fixed.

Optional improvements
- Cache the caption with a short TTL in-memory or a very small Redis entry to reduce DB reads.
- Add an audit log table for caption changes.
- Build a small CMS-like page that manages multiple top-level site strings using the same `ai_settings` table.

Next step suggestions (I can do any of these):
- Implement the Admin API and homepage read code (server patches).
- Scaffold the admin UI page and wire the PUT request.
- Add automated tests for the API.
- Deploy and manually verify on Vercel.
