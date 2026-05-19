import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getTripsByUser, syncTripStatuses } from "@/lib/db/trips";
import { TripCard } from "@/components/trips/TripCard";
import { getAlertCountsByUser } from "@/lib/db/weather";
import { runWeatherCheck } from "@/lib/weather/check";

export const metadata = { title: "Dashboard — RouteCrafted" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Auto-sync trip statuses based on current date
  await syncTripStatuses(session.user.id);

  const [trips, alertCounts] = await Promise.all([
    getTripsByUser(session.user.id),
    getAlertCountsByUser(session.user.id),
  ]);

  // Background weather check for upcoming trips (within Open-Meteo's 16-day window)
  const today = new Date();
  const cutoff = new Date(today.getTime() + 16 * 86_400_000);
  const upcomingTrips = trips.filter((t) => {
    const start = new Date(t.startDate + "T00:00:00");
    const end = new Date(t.endDate + "T00:00:00");
    return end >= today && start <= cutoff;
  });
  // Fire-and-forget: failures silently skipped, page never blocked
  void Promise.allSettled(
    upcomingTrips.map((t) => runWeatherCheck(t.id, session.user.id)),
  );

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Left Sidebar ── */}
          <aside className="hidden lg:flex lg:col-span-3 flex-col gap-6">
            {/* Preferences panel */}
            <div className="bg-surface-container-low p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                <h3 className="font-headline font-bold text-on-surface text-sm uppercase tracking-wider">Profile</h3>
              </div>
              <div className="space-y-3">
                {[
                  { icon: 'check_circle', label: session.user.name },
                  { icon: 'mail', label: session.user.email },
                  { icon: 'star', label: session.user.role ?? 'traveler' },
                ].map((row) => (
                  <div key={row.label} className="bg-surface-container-lowest rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[18px]">{row.icon}</span>
                    <span className="text-sm text-on-surface-variant truncate">{row.label}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/profile"
                className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-on-surface-variant border border-outline-variant rounded-full px-4 py-2 hover:bg-surface-container transition-colors w-full"
              >
                Edit Profile
              </Link>
            </div>

            {/* Stats panel */}
            <div className="bg-surface-container-low p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
                <h3 className="font-headline font-bold text-on-surface text-sm uppercase tracking-wider">Stats</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Total Trips', value: trips.length },
                  { label: 'Active', value: trips.filter(t => t.status === 'active').length },
                  { label: 'Completed', value: trips.filter(t => t.status === 'completed').length },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">{stat.label}</span>
                    <span className="font-headline font-bold text-on-surface text-lg">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="col-span-1 lg:col-span-9">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
                  My Journeys
                </h1>
                <p className="text-on-surface-variant mt-1 text-sm">
                  {trips.length > 0
                    ? `${trips.length} trip${trips.length !== 1 ? 's' : ''} planned`
                    : 'Start planning your first adventure'}
                </p>
              </div>
              <Link
                href="/trips/new"
                className="flex-shrink-0 inline-flex items-center gap-2 horizon-gradient text-on-primary font-headline font-bold rounded-full px-6 py-3 shadow-card hover:opacity-90 transition"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Trip
              </Link>
            </div>

            {/* Trips grid */}
            {trips.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {trips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} alertCount={alertCounts[trip.id] ?? 0} />
                ))}
                {/* Empty slot CTA */}
                <Link
                  href="/trips/new"
                  className="flex flex-col items-center justify-center gap-4 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant p-12 hover:bg-surface-container transition-colors min-h-[260px]"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px] text-primary">add_location_alt</span>
                  </div>
                  <div className="text-center">
                    <p className="font-headline font-bold text-on-surface">Plan a new trip</p>
                    <p className="text-sm text-on-surface-variant mt-1">AI-powered itinerary in seconds</p>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant p-16 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-[40px] text-primary">add_location_alt</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">No trips yet</h2>
                  <p className="text-on-surface-variant mb-6">Create your first AI-powered itinerary to get started</p>
                  <Link
                    href="/trips/new"
                    className="inline-flex items-center gap-2 horizon-gradient text-on-primary font-headline font-bold rounded-full px-8 py-4 shadow-card hover:opacity-90 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Plan my first trip
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
