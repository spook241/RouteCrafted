import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getDaysByTrip, getDayWithItems } from "@/lib/db/itinerary";
import { runWeatherCheck } from "@/lib/weather/check";
import { getActiveAlertsByTrip } from "@/lib/db/weather";
import { GenerateItineraryButton } from "@/components/itinerary/GenerateItineraryButton";
import { DayCard } from "@/components/itinerary/DayCard";
import { WeatherAlertBanner } from "@/components/weather/WeatherAlertBanner";
import { RefreshWeatherButton } from "@/components/weather/RefreshWeatherButton";
import { PlaceCard } from "@/components/places/PlaceCard";
import { GeneratePlaceCardsButton } from "@/components/places/GeneratePlaceCardsButton";
import { getPlaceCardsWithSchedule } from "@/lib/db/places";
import { TripCoverUpload } from "@/components/trips/TripCoverUpload";
import { TripDeleteButton } from "@/components/trips/TripDeleteButton";
import { TripRatingModal } from "@/components/trips/TripRatingModal";
import { TripDetailActions } from "@/components/trips/TripDetailActions";
import { ItineraryStaleBanner } from "@/components/trips/ItineraryStaleBanner";

type Props = { params: Promise<{ id: string }> };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-container-high text-on-surface-variant",
  active: "bg-primary-container text-on-primary",
  completed: "bg-secondary text-on-secondary",
  planned: "bg-tertiary-fixed text-on-tertiary-fixed",
};

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Trip ${id} — RouteCrafted` };
}

export default async function TripDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const trip = await getTripById(id, session.user.id);
  if (!trip) notFound();

  // Auto-check weather on every page open (idempotent, cached forecast)
  const [days, alerts, placeCards] = await Promise.all([
    getDaysByTrip(id),
    runWeatherCheck(id, session.user.id)
      .then(() => getActiveAlertsByTrip(id))
      .catch(() => getActiveAlertsByTrip(id)),
    getPlaceCardsWithSchedule(id),
  ]);

  // Fetch item counts for each day
  const dayCounts = await Promise.all(
    days.map(async (day) => {
      const full = await getDayWithItems(id, day.dayNumber);
      return { dayId: day.id, count: full?.items.length ?? 0 };
    }),
  );
  const countMap = new Map(dayCounts.map((d) => [d.dayId, d.count]));

  const nights =
    Math.round(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        86_400_000,
    ) || 0;

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Back nav */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface transition mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          My Journeys
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Main column ── */}
          <div className="lg:col-span-8 space-y-8">

            {/* Trip header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
                    {trip.destination}
                  </h1>
                  <span className={`text-xs font-label font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[trip.status] ?? STATUS_STYLES.draft}`}>
                    {label(trip.status)}
                  </span>
                </div>
                <p className="text-on-surface-variant">{trip.country}</p>
                <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  {formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {nights} night{nights !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {days.length > 0 && <RefreshWeatherButton tripId={id} />}
                {trip.status === "completed" && (
                  <TripRatingModal
                    tripId={id}
                    currentRating={trip.rating}
                    currentComment={trip.comment}
                  />
                )}
                <TripDeleteButton tripId={id} variant="button" redirectTo="/dashboard" />
              </div>
            </div>

            {/* Cover image upload */}
            <TripCoverUpload tripId={id} currentUrl={trip.coverImageUrl ?? null} isLocked={trip.status === "completed"} />

            {/* Weather Alerts */}
            {alerts.length > 0 && trip.status !== "completed" && (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <WeatherAlertBanner
                    key={alert.id}
                    alert={{
                      id: alert.id,
                      tripId: alert.tripId,
                      dayId: alert.dayId,
                      alertType: alert.alertType,
                      forecastCode: alert.forecastCode,
                      weatherLabel: alert.weatherLabel,
                    }}
                    dayNumber={alert.dayNumber}
                    date={alert.date}
                    theme={alert.theme}
                  />
                ))}
              </div>
            )}

            {/* Stale itinerary banner */}
            {days.length > 0 && trip.itineraryStale && (
              <ItineraryStaleBanner tripId={id} />
            )}

            {/* Day pills */}
            {days.length > 0 && (
              <div>
                <h2 className="font-headline font-bold text-on-surface text-lg mb-4">Itinerary</h2>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {days.map((day) => (
                    <Link
                      key={day.id}
                      href={`/trips/${id}/day/${day.dayNumber}`}
                      className="flex-shrink-0 w-20 h-24 rounded-2xl bg-surface-container-lowest shadow-card hover:shadow-card-hover flex flex-col items-center justify-center gap-1 transition-shadow group"
                    >
                      <span className="text-xs font-label font-semibold text-on-surface-variant group-hover:text-primary transition-colors">
                        Day
                      </span>
                      <span className="font-headline font-extrabold text-2xl text-on-surface group-hover:text-primary transition-colors">
                        {day.dayNumber}
                      </span>
                      <span className="text-[10px] font-label text-on-surface-variant text-center px-1 leading-tight line-clamp-2">
                        {day.theme}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Generate itinerary CTA */}
            {days.length === 0 && (
              <div className="bg-surface-container-lowest rounded-3xl p-10 text-center shadow-card">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-primary text-[40px]">auto_awesome</span>
                </div>
                <h2 className="font-headline font-bold text-2xl text-on-surface mb-3">Ready to plan?</h2>
                <p className="text-on-surface-variant text-sm mb-8 max-w-sm mx-auto">
                  Our AI will generate a day-by-day itinerary tailored to your preferences.
                </p>
                <GenerateItineraryButton
                  tripId={id}
                  trip={{
                    destination: trip.destination,
                    country: trip.country,
                    startDate: trip.startDate,
                    endDate: trip.endDate,
                    travelStyle: trip.travelStyle,
                    groupType: trip.groupType,
                    budgetRange: trip.budgetRange,
                    pacing: trip.pacing,
                    coverImageUrl: trip.coverImageUrl ?? null,
                  }}
                />
              </div>
            )}

            {/* Place Cards */}
            {days.length > 0 && (
              <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-headline font-bold text-on-surface text-lg">
                      Place Cards
                      {placeCards.length > 0 && (
                        <span className="ml-2 text-sm font-label font-normal text-on-surface-variant">
                          {placeCards.length} cards
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1">Worth It / Skip It verdicts for your activities</p>
                  </div>
                  <GeneratePlaceCardsButton tripId={id} hasItinerary={days.length > 0} disabled={trip.status === "completed"} />
                </div>
                {placeCards.length === 0 ? (
                  <p className="text-on-surface-variant text-sm text-center py-6">
                    No place cards yet — generate them above.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {placeCards.map((card) => (
                      <PlaceCard
                        key={card.id}
                        card={card}
                        scheduledDay={card.scheduledDay}
                        scheduledTime={card.scheduledTime}
                        tripId={id}
                        isLocked={trip.status === "completed"}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Trip preferences */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card">
              <h3 className="font-headline font-bold text-on-surface mb-5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
                  Trip Details
                </span>
                <TripDetailActions trip={trip} hasItinerary={days.length > 0} />
              </h3>
              <dl className="space-y-3">
                {[
                  { key: 'Budget', val: trip.budgetRange, icon: 'payments' },
                  { key: 'Style', val: trip.travelStyle, icon: 'style' },
                  { key: 'Group', val: trip.groupType, icon: 'group' },
                  { key: 'Pacing', val: trip.pacing, icon: 'speed' },
                ].map(({ key, val, icon }) => (
                  <div key={key} className="flex items-center gap-3 bg-surface-container-low px-4 py-3 rounded-2xl">
                    <span className="material-symbols-outlined text-[18px] text-outline">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-on-surface-variant font-label">{key}</p>
                      <p className="text-sm font-semibold text-on-surface">{label(val)}</p>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Budget tracker placeholder */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card">
              <h3 className="font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">account_balance_wallet</span>
                Budget
              </h3>
              <p className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider mb-1">Range</p>
              <p className="font-headline font-extrabold text-3xl text-on-surface capitalize">{trip.budgetRange}</p>
              <p className="text-xs text-on-surface-variant mt-2">Detailed expense tracking coming soon.</p>
            </div>

            {/* Pro tip */}
            <div className="bg-surface-container-low rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-wider">Pro Tip</p>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Click on any day pill to see the full timeline and activities. Use the Rewrite button to let AI regenerate a day based on weather or preferences.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
