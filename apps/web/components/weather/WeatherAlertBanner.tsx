"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const WEATHER_ICONS: Record<number, string> = {};

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "🌥";
  if (code <= 49) return "🌫";
  if (code <= 57) return "🌦";
  if (code <= 67) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌧";
  if (code <= 86) return "🌨";
  if (code <= 99) return "⛈";
  return "⚠";
}

interface ForecastDay {
  date: string;
  weatherCode: number;
  label: string;
  maxTempC: number;
  precipProbability: number;
}

interface Props {
  alert: {
    id: string;
    tripId: string;
    dayId: string;
    alertType: string;
    forecastCode: number;
    weatherLabel: string | null;
  };
  dayNumber: number;
  date: string;
  theme: string;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function WeatherAlertBanner({ alert, dayNumber, date, theme }: Props) {
  const router = useRouter();
  const [rewriting, setRewriting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const busy = rewriting || dismissing;

  async function handleRewrite() {
    setRewriting(true);
    try {
      const res = await fetch("/api/itinerary/rewrite-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: alert.tripId,
          dayId: alert.dayId,
          forecastCode: alert.forecastCode,
          weatherLabel: alert.weatherLabel ?? undefined,
        }),
      });
      if (res.ok) {
        await fetch(`/api/weather/dismiss/${alert.id}`, { method: "POST" });
        router.refresh();
      }
    } finally {
      setRewriting(false);
    }
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch(`/api/weather/dismiss/${alert.id}`, { method: "POST" });
      router.refresh();
    } finally {
      setDismissing(false);
    }
  }

  async function openForecast() {
    setShowModal(true);
    if (forecast) return; // already loaded
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/weather/forecast/${alert.tripId}`);
      if (res.ok) {
        const data = (await res.json()) as { forecast: ForecastDay[] };
        setForecast(data.forecast);
      }
    } finally {
      setForecastLoading(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal]);

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container rounded-3xl p-6 shadow-xl text-white">
        {/* Decorative icon */}
        <span
          className="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] text-white/10 select-none pointer-events-none"
          aria-hidden
        >
          thunderstorm
        </span>

        <div className="relative flex items-start gap-4">
          <span className="material-symbols-outlined text-[32px] text-tertiary-fixed mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-headline font-bold text-lg leading-snug">
              Day {dayNumber} — {formatDate(date)}
            </p>
            <p className="text-blue-100 text-sm font-medium mt-0.5">{theme}</p>
            {alert.weatherLabel && (
              <button
                onClick={openForecast}
                className="text-left text-blue-100/80 text-sm mt-1 hover:text-white underline underline-offset-2 transition-colors flex items-center gap-1"
              >
                {alert.weatherLabel}
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative flex items-center gap-3 mt-5">
          <button
            onClick={handleRewrite}
            disabled={busy}
            className="bg-tertiary-fixed hover:bg-tertiary-fixed-dim disabled:opacity-50 text-on-tertiary-fixed text-sm font-headline font-bold rounded-full px-5 py-2 transition"
          >
            {rewriting ? "Rewriting…" : "Adjust Plan"}
          </button>
          <button
            onClick={openForecast}
            disabled={busy}
            className="bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white text-sm font-headline font-bold rounded-full px-5 py-2 transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">cloud</span>
            Full Forecast
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            className="text-white/70 hover:text-white disabled:opacity-50 text-sm font-medium transition px-3 py-2"
          >
            {dismissing ? "…" : "Dismiss"}
          </button>
        </div>
      </div>

      {/* ── Forecast Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-surface rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  cloud
                </span>
                <h2 className="font-headline font-bold text-on-surface text-lg">Daily Forecast</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {forecastLoading && (
                <div className="flex items-center justify-center py-10 gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                  Loading forecast…
                </div>
              )}

              {!forecastLoading && forecast && forecast.length === 0 && (
                <p className="text-center text-on-surface-variant py-8 text-sm">
                  No forecast data available. Make sure the trip has location coordinates.
                </p>
              )}

              {!forecastLoading && forecast && forecast.length > 0 && (
                <div className="space-y-2">
                  {forecast.map((day, i) => (
                    <div
                      key={day.date}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${day.date === date ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface-container-low"}`}
                    >
                      {/* Emoji */}
                      <span className="text-2xl w-8 text-center flex-shrink-0">{weatherEmoji(day.weatherCode)}</span>

                      {/* Date */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${day.date === date ? "text-primary" : "text-on-surface"}`}>
                          {formatDateLong(day.date)}
                          {day.date === date && (
                            <span className="ml-2 text-xs font-label font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              alert day
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{day.label}</p>
                      </div>

                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-on-surface">{day.maxTempC}°C</p>
                        {day.precipProbability > 0 && (
                          <p className="text-xs text-on-surface-variant flex items-center justify-end gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">water_drop</span>
                            {day.precipProbability}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-2 border-t border-outline-variant/30 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm font-label font-semibold text-on-surface-variant hover:text-on-surface transition-colors px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
