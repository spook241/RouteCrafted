import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, trips, placeCards, adminFlags } from "@/lib/db/schema";
import { count as drizzleCount, eq } from "drizzle-orm";

export const metadata = { title: "Admin — RouteCrafted" };

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [[totalUsers], [totalTrips], [totalCards], [openFlags]] =
    await Promise.all([
      db.select({ value: drizzleCount() }).from(users),
      db.select({ value: drizzleCount() }).from(trips),
      db.select({ value: drizzleCount() }).from(placeCards),
      db
        .select({ value: drizzleCount() })
        .from(adminFlags)
        .where(eq(adminFlags.status, "open")),
    ]);

  const stats = [
    { label: "Users", value: Number(totalUsers.value) },
    { label: "Trips", value: Number(totalTrips.value) },
    { label: "Place Cards", value: Number(totalCards.value) },
    { label: "Open Flags", value: Number(openFlags.value) },
  ];

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">Administration</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-1">Admin Panel</h1>
          <p className="text-on-surface-variant">RouteCrafted platform management</p>
        </div>

        {/* Live stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-surface-container-lowest rounded-3xl p-5 text-center shadow-card"
            >
              <p className="font-headline font-extrabold text-3xl text-on-surface">{s.value}</p>
              <p className="text-xs font-label text-on-surface-variant mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/ai" className="group block">
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <span className="material-symbols-outlined text-primary text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <h2 className="font-headline font-bold text-on-surface text-lg group-hover:text-primary transition-colors">
                AI Configuration
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Edit prompt templates, version history, model selection, and weather context variables.
              </p>
            </div>
          </Link>

          <Link href="/admin/users" className="group block">
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <span className="material-symbols-outlined text-primary text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              <h2 className="font-headline font-bold text-on-surface text-lg group-hover:text-primary transition-colors">
                Users
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                View all {Number(totalUsers.value)} users, promote to admin or demote to traveler.
              </p>
            </div>
          </Link>

          <Link href="/admin/flags" className="group block">
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <span className="material-symbols-outlined text-primary text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
              <h2 className="font-headline font-bold text-on-surface text-lg group-hover:text-primary transition-colors">
                Moderation Flags
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Review and resolve flagged place cards.{" "}
                {Number(openFlags.value) > 0 && (
                  <span className="text-tertiary-fixed font-semibold">
                    {Number(openFlags.value)} open
                  </span>
                )}
              </p>
            </div>
          </Link>

          <div className="bg-surface-container-low rounded-3xl p-6">
            <span className="material-symbols-outlined text-outline text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
            <h2 className="font-headline font-bold text-on-surface text-lg">Platform Stats</h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {Number(totalTrips.value)} trips · {Number(totalCards.value)} place cards across {Number(totalUsers.value)} users.
            </p>
          </div>

          <Link href="/admin/diagnostics" className="group block">
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <span className="material-symbols-outlined text-primary text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>monitor_heart</span>
              <h2 className="font-headline font-bold text-on-surface text-lg group-hover:text-primary transition-colors">
                Diagnostics
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Test all external integrations — database, AI, storage, email, weather, and maps.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
