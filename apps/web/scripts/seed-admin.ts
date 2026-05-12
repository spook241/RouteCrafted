/**
 * Seed script — creates the initial admin user.
 * Run once:  npx tsx scripts/seed-admin.ts
 *
 * Credentials are set via environment variables so they are never hard-coded.
 *   ADMIN_EMAIL     (default: admin@routecrafted.com)
 *   ADMIN_PASSWORD  (required — no default for security)
 *   ADMIN_NAME      (default: Admin)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local when running locally (no-op on Vercel where env vars are injected)
dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { users } from "../lib/db/schema";

const email = process.env.ADMIN_EMAIL ?? "admin@routecrafted.com";
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Admin";

if (!password) {
  console.error(
    "❌  ADMIN_PASSWORD env var is required.\n" +
      "    Run:  ADMIN_PASSWORD=yourpassword npx tsx scripts/seed-admin.ts"
  );
  process.exit(1);
}

const safePassword: string = password;

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema: { users } });

async function main() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const passwordHash = await bcrypt.hash(safePassword, 12);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ passwordHash, name, role: "admin" })
      .where(eq(users.email, email));
    console.log(`✅  Admin user updated (password synced from env):`);
    console.log(`    Email : ${email}`);
    console.log("\n   Login at /login");
    process.exit(0);
  }

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, name, role: "admin" })
    .returning({ id: users.id, email: users.email, role: users.role });

  console.log("✅  Admin user created:");
  console.log(`    Email : ${created.email}`);
  console.log(`    Role  : ${created.role}`);
  console.log(`    ID    : ${created.id}`);
  console.log("\n   Login at /login");
}

main().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
