'use client';

import { useEffect, useRef, useState } from "react";

export interface TripInfo {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  travelStyle: string;
  groupType: string;
  budgetRange: string;
  pacing: string;
  coverImageUrl: string | null;
}

export type StepStatus = 'pending' | 'active' | 'done';
export type StepStates = Record<string, StepStatus>;

export interface StreamedCard {
  id: string;
  name: string;
  category: string | null;
  verdict: 'worth_it' | 'skip_it' | 'depends';
  imageUrl: string | null;
  summary: string | null;
}

interface GenerationResult {
  days: number;
  cards: number;
}

interface Props {
  isOpen: boolean;
  trip: TripInfo;
  stepStates: StepStates;
  result: GenerationResult | null;
  error: string | null;
  tips?: string[];
  cards?: StreamedCard[];
  aiTokens?: number;
  onDone: () => void;
}

const STEPS = [
  { key: 'profile',  icon: 'travel_explore', label: 'Reading your trip profile' },
  { key: 'ai',       icon: 'auto_awesome',   label: 'Crafting your day-by-day plan' },
  { key: 'schedule', icon: 'schedule',        label: 'Scheduling activities & timing' },
  { key: 'research', icon: 'location_on',     label: 'Researching each place' },
  { key: 'verdicts', icon: 'thumb_up',        label: 'Generating Worth It / Skip It verdicts' },
  { key: 'finalise', icon: 'check_circle',    label: 'Finalising your itinerary' },
] as const;

const FALLBACK_TIPS = [
  // Timing & crowds
  "Mornings are best for popular attractions — fewer crowds, softer light.",
  "Arrive at museums right when they open — you'll often have entire rooms to yourself.",
  "Sunset viewpoints get packed; arrive at golden hour and stay — the after-dark view is usually better anyway.",
  "Tuesdays and Wednesdays are the quietest days at most tourist sites worldwide.",

  // Planning philosophy
  "Great itineraries mix iconic landmarks with hidden local gems.",
  "Build in free afternoons — the best travel memories are often unplanned.",
  "One slow day for every three busy days keeps energy high the whole trip.",
  "Leave the last day unscheduled for anything you loved and want to revisit.",

  // Money
  "Budget a 15% flex fund for spontaneous discoveries.",
  "City tourist cards pay off only if you'll use 4+ attractions — do the maths first.",
  "Street food at busy local markets is often safer, fresher, and far tastier than tourist restaurants.",
  "ATMs inside bank branches have lower skimming risk than standalone machines.",

  // Food
  "The best meals are rarely at the most famous restaurants.",
  "Ask your accommodation host where they eat lunch — never the tourist strip.",
  "A neighbourhood bakery at 8 am tells you more about a city than any guidebook.",
  "Lunch menus at fine-dining spots are often half the price of the same dishes at dinner.",

  // Navigation & exploration
  "Walking between spots reveals a city's real character.",
  "Download offline maps before you leave the hotel — roaming data runs out at the worst moments.",
  "Getting slightly lost on purpose is one of the most reliable ways to find something memorable.",
  "A single metro line ridden end-to-end shows you neighbourhoods no tour bus ever visits.",

  // Packing & logistics
  "Pack one fewer outfit than you think you need — laundry services are everywhere.",
  "A lightweight day-bag inside your main luggage turns any trip into a hands-free day.",
  "Screenshot your booking confirmations — wifi in transit zones is notoriously unreliable.",
  "Noise-cancelling headphones are the single biggest quality-of-life upgrade for long travel days.",

  // Mindset
  "Slow down — travellers who race to tick off every sight remember the least.",
  "Talk to other travellers at your accommodation; their current intel beats any travel blog.",
  "A long coffee at a neighbourhood café teaches you more about local life than ten monuments.",
  "The version of a place in your memory is always better when you left wanting more.",

  // Spontaneity & serendipity
  "Say yes to one thing each day that wasn't on the plan.",
  "The most interesting streets are usually one block behind the main tourist drag.",
  "Locals move fast in the morning — follow them and you'll find where the city actually eats breakfast.",
  "A long walk back to the hotel after dinner often becomes the highlight of the day.",
];

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const nights = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}  ·  ${nights} night${nights !== 1 ? 's' : ''}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function verdictConfig(verdict: StreamedCard['verdict']) {
  switch (verdict) {
    case 'worth_it':  return { label: 'Worth It',  emoji: '⭐', bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' };
    case 'skip_it':   return { label: 'Skip It',   emoji: '⚠️', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' };
    case 'depends':   return { label: 'Depends',   emoji: '🤔', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' };
  }
}

function LivePlaceCard({ card }: { card: StreamedCard }) {
  const vc = verdictConfig(card.verdict);
  return (
    <div className="shrink-0 w-40 rounded-2xl overflow-hidden bg-white shadow-md border border-surface-container-high flex flex-col animate-fade-in-up">
      {/* Image */}
      <div className="h-28 bg-surface-container overflow-hidden relative">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 horizon-gradient opacity-60" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 px-2.5 py-2 flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">{card.name}</p>
        {card.category && (
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wide font-medium truncate">{card.category}</p>
        )}
        <div className={`inline-flex items-center gap-1 self-start mt-auto px-2 py-0.5 rounded-full border text-[10px] font-semibold ${vc.bg} ${vc.text} ${vc.border}`}>
          <span className="text-[10px]">{vc.emoji}</span>
          {vc.label}
        </div>
      </div>
    </div>
  );
}

export function GenerationProgressModal({
  isOpen,
  trip,
  stepStates,
  result,
  error,
  tips,
  cards = [],
  aiTokens = 0,
  onDone,
}: Props) {
  const effectiveTips = tips && tips.length > 0 ? tips : FALLBACK_TIPS;
  const [tipIdx, setTipIdx] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotate tips every 5s while generating
  useEffect(() => {
    if (!isOpen || result !== null || error !== null) return;
    const interval = setInterval(() => {
      setTipVisible(false);
      tipTimer.current = setTimeout(() => {
        setTipIdx((i) => i + 1);
        setTipVisible(true);
      }, 500);
    }, 10000);
    return () => {
      clearInterval(interval);
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, [isOpen, result, error]);

  if (!isOpen) return null;

  // Overall progress (0-100)
  const doneCount = STEPS.filter((s) => stepStates[s.key] === 'done').length;
  const hasActive = STEPS.some((s) => stepStates[s.key] === 'active');
  const progress = result
    ? 100
    : Math.round(((doneCount + (hasActive ? 0.45 : 0)) / STEPS.length) * 100);

  // Display label below the stepper
  const activeStep = STEPS.find((s) => stepStates[s.key] === 'active');
  const lastDoneStep = [...STEPS].reverse().find((s) => stepStates[s.key] === 'done');
  const baseLabel = result
    ? 'Your itinerary is ready!'
    : error
    ? 'Something went wrong — please try again in a few minutes.'
    : activeStep?.label ?? lastDoneStep?.label ?? 'Preparing…';
  const displayLabel =
    !result && !error && activeStep?.key === 'ai' && aiTokens > 0
      ? `${baseLabel}  ·  ${aiTokens} tokens`
      : baseLabel;

  const chips = [trip.travelStyle, trip.groupType, trip.budgetRange, trip.pacing].map(capitalize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl flex flex-col">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="relative shrink-0" style={{ height: '280px' }}>
          {trip.coverImageUrl ? (
            <img
              src={trip.coverImageUrl}
              alt={trip.destination}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 horizon-gradient" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          {/* Trip chips */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="text-[10px] font-label font-semibold text-white/90 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1"
              >
                {c}
              </span>
            ))}
          </div>

          {/* Destination name + dates */}
          <div className="absolute bottom-5 left-6 right-6">
            <h2 className="font-headline font-extrabold text-3xl text-white leading-tight drop-shadow">
              {trip.destination}
            </h2>
            <p className="text-white/70 text-sm mt-1">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          </div>
        </div>

        {/* ── Info card (tip / result / error) ──────────────────── */}
        <div className="px-6 -mt-4 relative z-10">
          {result ? (
            <>
              <div className="bg-secondary/10 rounded-2xl px-5 py-4 flex items-center justify-center gap-8">
                <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    calendar_month
                  </span>
                  {result.days} day{result.days !== 1 ? 's' : ''} planned
                </div>
                <div className="w-px h-5 bg-secondary/20" />
                <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    location_on
                  </span>
                  {result.cards} place{result.cards !== 1 ? 's' : ''} researched
                </div>
              </div>
              {cards.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-on-surface-variant mb-2">Places researched</p>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                    {cards.map((card) => (
                      <LivePlaceCard key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : error ? (
            <div className="bg-surface-container-low rounded-2xl px-5 py-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px] mt-0.5 shrink-0">
                info
              </span>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Something went wrong — please try again in a few minutes.
              </p>
            </div>
          ) : (
            /* Show tip only while research hasn't started yet */
            stepStates.research === 'pending' && (
              <div
                className="bg-surface-container-low rounded-2xl px-5 py-4 flex items-start gap-3 transition-opacity duration-500"
                style={{ opacity: tipVisible ? 1 : 0 }}
              >
                <span
                  className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lightbulb
                </span>
                <p className="text-xs text-on-surface-variant leading-relaxed">{effectiveTips[tipIdx % effectiveTips.length]}</p>
              </div>
            )
          )}
        </div>

        {/* ── Live place card strip (during + after research) ───── */}
        {(stepStates.research === 'active' || stepStates.research === 'done' || cards.length > 0) && !result && !error && (
          <div className="px-6 pt-4">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-3">
              {stepStates.research === 'active' ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs font-semibold text-on-surface-variant">
                    Researching places
                    {cards.length > 0 && (
                      <span className="ml-1.5 text-primary font-bold">{cards.length} done</span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-secondary text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="text-xs font-semibold text-secondary">
                    {cards.length} place{cards.length !== 1 ? 's' : ''} researched
                  </span>
                </>
              )}
            </div>

            {/* Horizontal scrollable card strip */}
            {cards.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {cards.map((card) => (
                  <LivePlaceCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              /* Skeleton placeholders while first cards load */
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="shrink-0 w-40 h-52 rounded-2xl bg-surface-container animate-pulse"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show tip during research phase alongside the card strip */}
        {(stepStates.research === 'active') && !result && !error && (
          <div
            className="mx-6 mt-3 bg-surface-container-low rounded-2xl px-4 py-3 flex items-start gap-2.5 transition-opacity duration-500"
            style={{ opacity: tipVisible ? 1 : 0 }}
          >
            <span
              className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">{effectiveTips[tipIdx % effectiveTips.length]}</p>
          </div>
        )}

        {/* ── Progress section ──────────────────────────────────── */}
        <div className="px-6 pb-6 pt-5 flex flex-col gap-4">

          {/* Step dots + connectors */}
          <div className="flex items-center">
            {STEPS.map((step, idx) => {
              const status = stepStates[step.key] ?? 'pending';
              const isLast = idx === STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  {/* Dot */}
                  <div className="relative flex items-center justify-center shrink-0">
                    {status === 'active' && (
                      <div className="absolute w-10 h-10 rounded-full bg-primary/20 animate-ping" />
                    )}
                    <div
                      className={[
                        'relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500',
                        status === 'done'
                          ? 'bg-secondary text-on-secondary'
                          : status === 'active'
                          ? 'bg-primary/15 text-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-surface-container-lowest'
                          : 'bg-surface-container text-on-surface-variant',
                      ].join(' ')}
                    >
                      {status === 'done' ? (
                        <span
                          className="material-symbols-outlined text-[15px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[15px]${status === 'pending' ? ' opacity-40' : ''}`}
                        >
                          {step.icon}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={[
                        'flex-1 h-px mx-1 transition-colors duration-700',
                        status === 'done' ? 'bg-secondary' : 'bg-surface-container-high',
                      ].join(' ')}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Active label */}
          <p className="text-center text-sm font-medium text-on-surface-variant leading-relaxed">
            {displayLabel}
          </p>

          {/* Progress bar */}
          {!error && (
            <div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full horizon-gradient rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {!result && (
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] font-mono text-on-surface-variant">{progress}%</span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          {result && (
            <button
              onClick={onDone}
              className="w-full horizon-gradient text-white font-headline font-bold rounded-full py-3.5 text-base flex items-center justify-center gap-2 hover:opacity-90 transition"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                explore
              </span>
              View My Itinerary
            </button>
          )}

          {error && (
            <button
              onClick={onDone}
              className="w-full bg-surface-container text-on-surface font-headline font-bold rounded-full py-3.5 text-base hover:bg-surface-container-high transition"
            >
              Try Again
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
