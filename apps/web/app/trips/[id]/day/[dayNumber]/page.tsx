import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getDayWithItems } from "@/lib/db/itinerary";
import { RewriteDayButton } from "@/components/itinerary/RewriteDayButton";
import { getPlaceCardsForItems } from "@/lib/db/places";
import { PlaceCardTrigger } from "@/components/places/PlaceCardTrigger";

type Props = { params: Promise<{ id: string; dayNumber: string }> };

const TYPE_STYLES: Record<string, string> = {
  activity: "bg-primary-container/20 text-on-primary",
  meal: "bg-tertiary-fixed/30 text-on-tertiary-fixed",
  transport: "bg-surface-container-high text-on-surface-variant",
};

const TYPE_ICONS: Record<string, string> = {
  activity: "hiking",
  meal: "restaurant",
  transport: "directions_bus",
};

const BLOCK_ICONS: Record<string, string> = {
  morning: "wb_sunny",
  afternoon: "light_mode",
  evening: "nightlight",
};

const BLOCK_ORDER = ["morning", "afternoon", "evening"] as const;

const PRICE_SYMBOLS: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€", 4: "€€€€" };

/** Find today's opening hours entry from the array, e.g. "Mon 09:00-18:00" */
function getTodayHours(openingHours: string[] | null, tripDate: string): string | null {
  if (!openingHours || openingHours.length === 0) return null;
  const dayAbbr = new Date(tripDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  const match = openingHours.find((h) => h.startsWith(dayAbbr));
  return match ?? openingHours[0];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Props) {
  const { id, dayNumber } = await params;
  return { title: `Day ${dayNumber} — RouteCrafted` };
}

export default async function DayPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id, dayNumber } = await params;
  const dayNum = Number(dayNumber);
  if (!Number.isInteger(dayNum) || dayNum < 1) notFound();

  const trip = await getTripById(id, session.user.id);
  if (!trip) notFound();

  const dayWithItems = await getDayWithItems(id, dayNum);
  if (!dayWithItems) notFound();

  const { items, ...day } = dayWithItems;

  // Fetch place cards for items that have one
  const linkedCardIds = items
    .map((i) => i.placeCardId)
    .filter((cid): cid is string => cid != null);
  const linkedCardsArray = await getPlaceCardsForItems(linkedCardIds);
  const cardMap = new Map(linkedCardsArray.map((c) => [c.id, c]));

  const itemsByBlock = BLOCK_ORDER.reduce(
    (acc, block) => {
      acc[block] = items.filter((i) => i.timeBlock === block);
      return acc;
    },
    {} as Record<string, typeof items>,
  );

  const totalCost = items.reduce(
    (sum, i) => sum + Number(i.estimatedCost ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Back nav */}
        <Link
          href={`/trips/${id}`}
          className="inline-flex items-center gap-2 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface transition mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to trip
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Main column ── */}
          <div className="lg:col-span-8 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-headline font-extrabold text-xl text-primary shrink-0">
                    {dayNum}
                  </span>
                  <div>
                    <p className="text-xs font-label text-on-surface-variant">{formatDate(day.date)}</p>
                    <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
                      {day.theme}
                    </h1>
                  </div>
                </div>
                {day.weatherLabel && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">partly_cloudy_day</span>
                    {day.weatherLabel}
                  </div>
                )}
              </div>
              <RewriteDayButton tripId={id} dayId={day.id} />
            </div>

            {/* Summary card */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card">
              <p className="text-on-surface leading-relaxed">{day.summary}</p>
              <div className="flex flex-wrap gap-4 mt-4">
                <span className="flex items-center gap-1.5 text-xs font-label text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                  {items.length} stop{items.length !== 1 ? 's' : ''}
                </span>
                {totalCost > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-label text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    Est. ${totalCost.toFixed(0)}
                  </span>
                )}
                {day.rewrittenAt && (
                  <span className="flex items-center gap-1.5 text-xs font-label text-primary">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    Rewritten by AI
                  </span>
                )}
              </div>
            </div>

            {/* Time blocks */}
            {BLOCK_ORDER.map((block) => {
              const blockItems = itemsByBlock[block];
              if (blockItems.length === 0) return null;
              return (
                <div key={block}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {BLOCK_ICONS[block]}
                    </span>
                    <h2 className="font-headline font-bold text-on-surface capitalize">{block}</h2>
                    <span className="text-xs text-on-surface-variant font-label ml-1">{blockItems.length} stop{blockItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-4 pl-4 border-l-2 border-surface-container-high">
                    {blockItems.map((item) => {
                      const card = item.placeCardId ? cardMap.get(item.placeCardId) : undefined;
                      const todayHours = card ? getTodayHours(card.openingHours ?? null, day.date) : null;
                      return (
                      <div
                        key={item.id}
                        className="bg-surface-container-lowest rounded-3xl shadow-card -ml-4 hover:shadow-card-hover transition-shadow overflow-hidden"
                      >
                        {/* Photo header */}
                        {card?.imageUrl && (
                          <div className="relative h-36 w-full">
                            <img
                              src={card.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                            {card.imageAttribution && (
                              <p className="absolute bottom-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-tl">
                                {card.imageAttribution}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="p-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-label font-semibold px-3 py-1 rounded-full flex items-center gap-1 ${TYPE_STYLES[item.type] ?? TYPE_STYLES.activity}`}>
                              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {TYPE_ICONS[item.type] ?? 'place'}
                              </span>
                              {item.type}
                            </span>
                            {item.isOptional && (
                              <span className="text-xs font-label italic text-on-surface-variant">optional</span>
                            )}
                            {item.bookingRequired && (
                              <span className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">bookmark</span>
                                Book ahead
                              </span>
                            )}
                            {/* Rating badge */}
                            {card?.rating != null && (
                              <span className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                {Number(card.rating).toFixed(1)}
                                {card.reviewCount != null && (
                                  <span className="font-normal opacity-70">({card.reviewCount.toLocaleString()})</span>
                                )}
                              </span>
                            )}
                            {/* Price level */}
                            {card?.priceLevel != null ? (
                              <span className="text-xs font-label font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                                {PRICE_SYMBOLS[card.priceLevel] ?? "€"}
                              </span>
                            ) : card?.costLevel && card.costLevel !== "free" ? (
                              <span className="text-xs font-label px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant capitalize">
                                {card.costLevel}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-label text-on-surface-variant">{item.durationMins} min</p>
                            {Number(item.estimatedCost) > 0 && (
                              <p className="text-sm font-semibold text-primary">${Number(item.estimatedCost).toFixed(0)}</p>
                            )}
                          </div>
                        </div>
                        <h3 className="font-headline font-bold text-on-surface text-lg mb-1">{item.title}</h3>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location + (trip.destination ? `, ${trip.destination}` : ""))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 hover:underline mb-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {item.location}
                          <span className="material-symbols-outlined text-[12px] opacity-60">open_in_new</span>
                        </a>
                        {/* Opening hours */}
                        {todayHours && (
                          <p className="inline-flex items-center gap-1 text-xs text-on-surface-variant mb-3 ml-0">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {todayHours}
                          </p>
                        )}
                        {!todayHours && <div className="mb-3" />}
                        <p className="text-sm text-on-surface-variant leading-relaxed">{item.description}</p>
                        {item.tips && (
                          <p className="mt-2 text-xs italic text-on-surface-variant flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[13px] shrink-0 mt-0.5">tips_and_updates</span>
                            {item.tips}
                          </p>
                        )}
                        {item.placeCardId && card && card.verdict === "worth_it" && (
                          <div className="mt-3">
                            <PlaceCardTrigger card={card} />
                          </div>
                        )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Day stats */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card">
              <h3 className="font-headline font-bold text-on-surface mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">today</span>
                Day at a Glance
              </h3>
              <dl className="space-y-3">
                {[
                  { label: 'Total stops', value: String(items.length), icon: 'pin_drop' },
                  { label: 'Est. spend', value: totalCost > 0 ? `$${totalCost.toFixed(0)}` : '—', icon: 'payments' },
                  { label: 'Morning', value: String(itemsByBlock.morning.length), icon: 'wb_sunny' },
                  { label: 'Afternoon', value: String(itemsByBlock.afternoon.length), icon: 'light_mode' },
                  { label: 'Evening', value: String(itemsByBlock.evening.length), icon: 'nightlight' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center justify-between bg-surface-container-low px-4 py-3 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-outline">{icon}</span>
                      <span className="text-sm font-label text-on-surface-variant">{label}</span>
                    </div>
                    <span className="font-semibold text-on-surface text-sm">{value}</span>
                  </div>
                ))}
              </dl>
            </div>

            {/* Day navigation */}
            <div className="bg-surface-container-low rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-primary">swap_horiz</span>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-wider">Navigate Days</p>
              </div>
              <div className="flex gap-3">
                {dayNum > 1 && (
                  <Link
                    href={`/trips/${id}/day/${dayNum - 1}`}
                    className="flex-1 flex items-center justify-center gap-1 bg-surface-container-lowest rounded-2xl py-3 text-sm font-label font-semibold text-on-surface hover:shadow-card transition-shadow"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    Day {dayNum - 1}
                  </Link>
                )}
                <Link
                  href={`/trips/${id}/day/${dayNum + 1}`}
                  className="flex-1 flex items-center justify-center gap-1 bg-surface-container-lowest rounded-2xl py-3 text-sm font-label font-semibold text-on-surface hover:shadow-card transition-shadow"
                >
                  Day {dayNum + 1}
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </Link>
              </div>
            </div>

            {/* Pro tip */}
            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-wider">Curator's Tip</p>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Use the Rewrite button to let AI adjust this day based on weather or revised preferences.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
