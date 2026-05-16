import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getTelemetrySummary, getTelemetryByTrip } from "@/lib/db/telemetry";

export const metadata = { title: "AI Telemetry — RouteCrafted Admin" };

function fmt(n: string | null | undefined): string {
  if (n == null) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString();
}

function fmtCost(n: string | null | undefined): string {
  if (n == null) return "—";
  const num = Number(n);
  if (isNaN(num)) return "—";
  return `$${num.toFixed(4)}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const CALL_TYPE_LABELS: Record<string, string> = {
  generate_itinerary: "Itinerary Generate",
  rewrite_day: "Day Rewrite",
  place_card: "Place Card",
};

export default async function TelemetryPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [{ totals, byType }, tripRows] = await Promise.all([
    getTelemetrySummary(),
    getTelemetryByTrip(),
  ]);

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface transition mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Admin
        </Link>

        <div className="mb-8">
          <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">Administration</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-1">AI Telemetry</h1>
          <p className="text-on-surface-variant">Token usage, latency, and cost across all AI calls</p>
        </div>

        {/* Global stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Calls", value: fmt(String(totals?.totalCalls ?? 0)), icon: "call_made" },
            { label: "Total Tokens", value: fmt(totals?.totalTokens), icon: "token" },
            { label: "Est. Total Cost", value: fmtCost(totals?.totalCostUsd), icon: "payments" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-3xl p-5 shadow-card">
              <span className="material-symbols-outlined text-primary text-[24px] mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              <p className="font-headline font-extrabold text-2xl text-on-surface">{s.value}</p>
              <p className="text-xs font-label text-on-surface-variant mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Breakdown by call type */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-card p-6 mb-8">
          <h2 className="font-headline font-bold text-on-surface text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">category</span>
            Breakdown by Call Type
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-label text-on-surface-variant border-b border-outline-variant">
                  <th className="pb-3 pr-6 font-semibold">Call Type</th>
                  <th className="pb-3 pr-6 font-semibold text-right">Calls</th>
                  <th className="pb-3 pr-6 font-semibold text-right">Tokens</th>
                  <th className="pb-3 font-semibold text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {byType.map((row) => (
                  <tr key={row.callType ?? "unknown"}>
                    <td className="py-3 pr-6 font-medium text-on-surface">
                      {CALL_TYPE_LABELS[row.callType ?? ""] ?? row.callType ?? "—"}
                    </td>
                    <td className="py-3 pr-6 text-right text-on-surface-variant">{fmt(String(row.calls))}</td>
                    <td className="py-3 pr-6 text-right text-on-surface-variant">{fmt(row.tokens)}</td>
                    <td className="py-3 text-right text-on-surface-variant">{fmtCost(row.costUsd)}</td>
                  </tr>
                ))}
                {byType.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-on-surface-variant text-xs">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-trip table */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-card p-6">
          <h2 className="font-headline font-bold text-on-surface text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">luggage</span>
            Per-Trip Usage
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-label text-on-surface-variant border-b border-outline-variant">
                  <th className="pb-3 pr-6 font-semibold">Trip</th>
                  <th className="pb-3 pr-6 font-semibold text-right">Calls</th>
                  <th className="pb-3 pr-6 font-semibold text-right">Tokens</th>
                  <th className="pb-3 pr-6 font-semibold text-right">Est. Cost</th>
                  <th className="pb-3 font-semibold text-right">Last Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {tripRows.map((row) => (
                  <tr key={row.tripId} className="group">
                    <td className="py-3 pr-6">
                      <Link
                        href={`/admin/telemetry/${row.tripId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.destination ?? "Unknown"}, {row.country ?? ""}
                      </Link>
                      {row.startDate && (
                        <p className="text-xs text-on-surface-variant">{row.startDate} → {row.endDate}</p>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right text-on-surface-variant">{fmt(String(row.calls))}</td>
                    <td className="py-3 pr-6 text-right text-on-surface-variant">{fmt(row.totalTokens)}</td>
                    <td className="py-3 pr-6 text-right text-on-surface-variant">{fmtCost(row.totalCostUsd)}</td>
                    <td className="py-3 text-right text-on-surface-variant text-xs">{fmtDate(row.lastCallAt)}</td>
                  </tr>
                ))}
                {tripRows.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant text-xs">No trip telemetry yet — generate an itinerary to start collecting data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
