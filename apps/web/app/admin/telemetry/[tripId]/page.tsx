import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDaysByTrip } from "@/lib/db/itinerary";
import { getTripTelemetry } from "@/lib/db/telemetry";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

type Props = { params: Promise<{ tripId: string }> };

export async function generateMetadata({ params }: Props) {
  const { tripId } = await params;
  return { title: `Trip Telemetry — RouteCrafted Admin` };
}

function fmt(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString();
}

function fmtCost(n: string | null | undefined): string {
  if (n == null) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return `$${num.toFixed(5)}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const CALL_TYPE_LABELS: Record<string, string> = {
  generate_itinerary: "Itinerary Generation",
  rewrite_day: "Day Rewrite",
  place_card: "Place Card",
};

const CALL_TYPE_ICONS: Record<string, string> = {
  generate_itinerary: "auto_awesome",
  rewrite_day: "edit_note",
  place_card: "star",
};

export default async function TripTelemetryPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const { tripId } = await params;

  const [rows, days] = await Promise.all([
    getTripTelemetry(tripId),
    getDaysByTrip(tripId),
  ]);

  if (rows.length === 0) notFound();

  // Build lookup maps for day + item labels
  const dayMap = new Map(days.map((d) => [d.id, d]));

  const allItemIds = rows.map((r) => r.itemId).filter((id): id is string => id != null);
  const items = allItemIds.length > 0
    ? await db.select().from(itineraryItems).where(inArray(itineraryItems.id, allItemIds))
    : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Group rows by callType
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    const key = row.callType ?? "unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const totalCost = rows.reduce((sum, r) => sum + Number(r.estimatedCostUsd ?? 0), 0);
  const totalTokens = rows.reduce((sum, r) => sum + Number(r.totalTokens ?? 0), 0);

  // Find trip destination from first row's tripId via days
  const firstDay = days[0];

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/admin/telemetry"
          className="inline-flex items-center gap-2 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface transition mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Trips
        </Link>

        <div className="mb-8">
          <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">AI Telemetry</p>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight mb-1">
            Trip Detail
          </h1>
          <p className="text-on-surface-variant font-mono text-xs break-all">{tripId}</p>
        </div>

        {/* Trip-level stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Calls", value: fmt(rows.length), icon: "call_made" },
            { label: "Total Tokens", value: fmt(totalTokens), icon: "token" },
            { label: "Est. Total Cost", value: fmtCost(String(totalCost)), icon: "payments" },
            { label: "Days", value: fmt(days.length), icon: "calendar_month" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-3xl p-5 shadow-card">
              <span className="material-symbols-outlined text-primary text-[22px] mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              <p className="font-headline font-extrabold text-2xl text-on-surface">{s.value}</p>
              <p className="text-xs font-label text-on-surface-variant mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sections per call type */}
        {(["generate_itinerary", "rewrite_day", "place_card"] as const).map((callType) => {
          const sectionRows = grouped[callType];
          if (!sectionRows || sectionRows.length === 0) return null;
          return (
            <div key={callType} className="bg-surface-container-lowest rounded-3xl shadow-card p-6 mb-6">
              <h2 className="font-headline font-bold text-on-surface text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {CALL_TYPE_ICONS[callType]}
                </span>
                {CALL_TYPE_LABELS[callType]}
                <span className="ml-auto text-xs font-label text-on-surface-variant font-normal">
                  {sectionRows.length} call{sectionRows.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-label text-on-surface-variant border-b border-outline-variant">
                      <th className="pb-3 pr-4 font-semibold">Label</th>
                      <th className="pb-3 pr-4 font-semibold text-right">In</th>
                      <th className="pb-3 pr-4 font-semibold text-right">Out</th>
                      <th className="pb-3 pr-4 font-semibold text-right">Total</th>
                      <th className="pb-3 pr-4 font-semibold text-right">Cost</th>
                      <th className="pb-3 pr-4 font-semibold text-right">Latency</th>
                      <th className="pb-3 font-semibold text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {sectionRows.map((row) => {
                      const day = row.dayId ? dayMap.get(row.dayId) : undefined;
                      const item = row.itemId ? itemMap.get(row.itemId) : undefined;
                      const label =
                        callType === "generate_itinerary" ? "Full itinerary" :
                        callType === "rewrite_day" && day ? `Day ${day.dayNumber} — ${day.theme}` :
                        callType === "place_card" && item ? item.title :
                        row.id.slice(0, 8) + "…";

                      return (
                        <tr key={row.id}>
                          <td className="py-3 pr-4">
                            <span className={`font-medium text-on-surface ${!row.success ? "line-through text-on-surface-variant" : ""}`}>
                              {label}
                            </span>
                            {!row.success && (
                              <p className="text-xs text-error mt-0.5">{row.errorMessage ?? "Error"}</p>
                            )}
                            {row.userEmail && (
                              <p className="text-xs text-on-surface-variant">{row.userEmail}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-on-surface-variant">{fmt(row.promptTokens)}</td>
                          <td className="py-3 pr-4 text-right text-on-surface-variant">{fmt(row.completionTokens)}</td>
                          <td className="py-3 pr-4 text-right text-on-surface-variant font-medium">{fmt(row.totalTokens)}</td>
                          <td className="py-3 pr-4 text-right text-on-surface-variant">{fmtCost(row.estimatedCostUsd)}</td>
                          <td className="py-3 pr-4 text-right text-on-surface-variant">
                            {row.latencyMs != null ? `${(row.latencyMs / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td className="py-3 text-right text-on-surface-variant text-xs">{fmtDate(row.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
