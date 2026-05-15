"use client";

import { useState, useEffect, useRef } from "react";
import { DayPicker, type DateRange, type DayButtonProps } from "react-day-picker";
import { format, differenceInCalendarDays } from "date-fns";
// No default CSS import — all styles are controlled below

// react-day-picker v9/v10 uses div-based layout — grid works correctly here
const CALENDAR_CSS = `
  /* ── Layout ── */
  .rcal-months { display: flex; gap: 40px; }
  .rcal-month  { width: 252px; }

  /* ── Caption (v9+: month_caption) ── */
  .rcal-caption {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px; padding: 0 2px;
  }
  .rcal-caption_label {
    font-size: 15px; font-weight: 700; color: #111c2d;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  /* ── Nav (v9+: button_previous / button_next) ── */
  .rcal-nav { display: flex; gap: 4px; }
  .rcal-nav_btn {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #424754; transition: background 0.15s;
  }
  .rcal-nav_btn:hover { background: rgba(0,88,190,0.1); color: #0058be; }

  /* ── Weekday header row (v9+: weekdays / weekday) ── */
  .rcal-weekdays { display: grid; grid-template-columns: repeat(7, 36px); margin-bottom: 4px; }
  .rcal-weekday {
    width: 36px; text-align: center; font-size: 11px; font-weight: 600;
    color: #424754; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 0;
  }

  /* ── Month grid (v9+: month_grid) ── */
  .rcal-month_grid { width: 100%; }

  /* ── Week row (v9+: week) ── */
  .rcal-week { display: grid; grid-template-columns: repeat(7, 36px); }

  /* ── Day cell/container (v9+: day) — taller to fit weather row ── */
  .rcal-day {
    width: 36px; height: 54px; padding: 2px 0; position: relative;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Weather line beneath the day number ── */
  .rcal-weather {
    position: absolute; bottom: 1px; left: 0; right: 0;
    display: flex; align-items: center; justify-content: center; gap: 1px;
    font-size: 9px; line-height: 1; color: #424754;
    pointer-events: none; z-index: 2;
  }
  .rcal-weather-emoji { font-size: 10px; line-height: 1; }


  /* ── Day button (v9+: day_button) ── */
  .rcal-day_btn {
    width: 36px; height: 36px; border-radius: 50%; border: none;
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; color: #111c2d;
    transition: background 0.12s, color 0.12s;
    position: relative; z-index: 1;
    /* sit above the ::before range band */
  }
  .rcal-day_btn:hover:not(:disabled) { background: rgba(0,88,190,0.1); }

  /* ── Today ── */
  .rcal-day--today .rcal-day_btn { font-weight: 800; color: #0058be; }
  .rcal-day--today .rcal-day_btn::after {
    content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: #0058be;
  }

  /* ── Range end-points ── */
  .rcal-day--range_start .rcal-day_btn,
  .rcal-day--range_end .rcal-day_btn {
    background: #0058be !important;
    color: #ffffff !important;
    font-weight: 600;
  }
  .rcal-day--range_start .rcal-day_btn::after,
  .rcal-day--range_end .rcal-day_btn::after { display: none; }

  /* ── Range band behind the circles ── */
  .rcal-day--range_middle::before {
    content: ''; position: absolute; inset: 2px 0;
    background: rgba(0,88,190,0.1); z-index: 0;
  }
  .rcal-day--range_start::before {
    content: ''; position: absolute; top: 2px; bottom: 2px; left: 50%; right: 0;
    background: rgba(0,88,190,0.1); z-index: 0;
  }
  .rcal-day--range_end::before {
    content: ''; position: absolute; top: 2px; bottom: 2px; left: 0; right: 50%;
    background: rgba(0,88,190,0.1); z-index: 0;
  }
  .rcal-day--range_middle .rcal-day_btn {
    color: #111c2d !important; background: none !important; z-index: 1;
  }

  /* ── Disabled / outside ── */
  .rcal-day--outside { opacity: 0.3; pointer-events: none; }
  .rcal-day--disabled .rcal-day_btn { opacity: 0.35; cursor: default; pointer-events: none; }
`;

interface ForecastEntry {
  emoji: string;
  maxTempC: number;
}

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD or ""
  endDate: string;   // YYYY-MM-DD or ""
  onChange: (start: string, end: string) => void;
  lat?: string | null;
  lon?: string | null;
}

function parseYMD(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function toYMD(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// v9/v10: single Chevron component replaces IconLeft/IconRight
function Chevron({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>
      {orientation === "left" ? "chevron_left" : "chevron_right"}
    </span>
  );
}

export function DateRangePicker({ startDate, endDate, onChange, lat, lon }: DateRangePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseYMD(startDate);
    const to = parseYMD(endDate);
    return from ? { from, to } : undefined;
  });

  const [open, setOpen] = useState(false);
  const [forecastMap, setForecastMap] = useState<Map<string, ForecastEntry>>(new Map());
  const [forecastLoading, setForecastLoading] = useState(false);
  const fetchedRef = useRef<string>(""); // tracks lat,lon already fetched

  // Clear stale forecast immediately when destination changes
  useEffect(() => {
    setForecastMap(new Map());
    fetchedRef.current = "";
  }, [lat, lon]);

  // Lazy-fetch forecast when calendar first opens (only if destination is known)
  useEffect(() => {
    if (!open || !lat || !lon) return;
    const key = `${lat},${lon}`;
    if (fetchedRef.current === key) return;

    setForecastLoading(true);
    fetch(`/api/weather/preview?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&days=16`)
      .then((r) => (r.ok ? r.json() : { forecast: [] }))
      .then((data: { forecast: { date: string; emoji: string; maxTempC: number }[] }) => {
        const map = new Map<string, ForecastEntry>();
        for (const d of data.forecast) map.set(d.date, { emoji: d.emoji, maxTempC: d.maxTempC });
        setForecastMap(map);
        fetchedRef.current = key;
      })
      .catch(() => {})
      .finally(() => setForecastLoading(false));
  }, [open, lat, lon]);

  // Custom day button: renders number + weather info below it
  function WeatherDayButton({ day, modifiers, ...buttonProps }: DayButtonProps) {
    const dateStr = toYMD(day.date);
    const wx = forecastMap.get(dateStr);
    return (
      <>
        <button {...buttonProps} className="rcal-day_btn">
          {day.date.getDate()}
        </button>
        {wx && (
          <span className="rcal-weather">
            <span className="rcal-weather-emoji">{wx.emoji}</span>
            <span>{wx.maxTempC}°</span>
          </span>
        )}
      </>
    );
  }

  function handleSelect(next: DateRange | undefined) {
    setRange(next);
    if (next?.from && next?.to) {
      onChange(toYMD(next.from), toYMD(next.to));
      // keep open so user can see the selection before moving on
    } else if (next?.from) {
      onChange(toYMD(next.from), "");
    } else {
      onChange("", "");
    }
  }

  const nights =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : null;

  const fromLabel = range?.from ? format(range.from, "d MMM yyyy") : null;
  const toLabel   = range?.to   ? format(range.to,   "d MMM yyyy") : null;

  const inputBase =
    "flex-1 flex items-center gap-3 px-4 py-3 bg-surface-container-low text-left cursor-pointer transition-colors hover:bg-surface-container focus:outline-none";

  return (
    <>
      {/* Inject CSS once */}
      <style>{CALENDAR_CSS}</style>

      <div className="relative">
        {/* ── Two-field trigger ── */}
        <div
          className={`flex rounded-2xl overflow-hidden border-2 transition-colors ${
            open ? "border-primary" : "border-outline-variant"
          }`}
        >
          {/* Departure */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${inputBase} border-r border-outline-variant`}
          >
            <span
              className="material-symbols-outlined shrink-0 text-[20px]"
              style={{ color: "#0058be" }}
            >
              flight_takeoff
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Departure date
              </p>
              <p
                className={`text-sm font-semibold ${
                  fromLabel ? "text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {fromLabel ?? "Select date"}
              </p>
            </div>
          </button>

          {/* Return */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={inputBase}
          >
            <span
              className="material-symbols-outlined shrink-0 text-[20px]"
              style={{ color: "#0058be" }}
            >
              flight_land
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Return date
                {nights !== null && (
                  <span className="ml-2 normal-case tracking-normal font-semibold text-primary">
                    · {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <p
                className={`text-sm font-semibold ${
                  toLabel ? "text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {toLabel ?? "Select date"}
              </p>
            </div>
          </button>
        </div>

        {/* ── Calendar panel ── */}
        {open && (
          <>
            <div
              className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 bg-white rounded-3xl p-6"
              style={{ boxShadow: "0 8px 48px rgba(17,28,45,0.18)", border: "1px solid #e2e8f0" }}
            >
              {/* Weather loading indicator */}
              {forecastLoading && lat && lon && (
                <div className="flex items-center gap-2 mb-3 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Loading weather…
                </div>
              )}

              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleSelect}
                numberOfMonths={2}
                disabled={{ before: today }}
                weekStartsOn={1}
                components={{ Chevron, DayButton: WeatherDayButton }}
                classNames={{
                  months:           "rcal-months",
                  month:            "rcal-month",
                  month_caption:    "rcal-caption",       // v9+: was "caption"
                  caption_label:    "rcal-caption_label",
                  nav:              "rcal-nav",
                  button_previous:  "rcal-nav_btn",       // v9+: was "nav_button_previous"
                  button_next:      "rcal-nav_btn",       // v9+: was "nav_button_next"
                  month_grid:       "rcal-month_grid",    // v9+: was "table"
                  weekdays:         "rcal-weekdays",      // v9+: was "head_row"
                  weekday:          "rcal-weekday",       // v9+: was "head_cell"
                  week:             "rcal-week",          // v9+: was "row"
                  day:              "rcal-day",           // v9+: was "cell"
                  day_button:       "rcal-day_btn",       // v9+: was "day"
                }}
                modifiersClassNames={{
                  today:        "rcal-day--today",
                  selected:     "rcal-day--selected",
                  range_start:  "rcal-day--range_start",
                  range_end:    "rcal-day--range_end",
                  range_middle: "rcal-day--range_middle",
                  outside:      "rcal-day--outside",
                  disabled:     "rcal-day--disabled",
                }}
              />

              {/* Footer */}
              <div
                className="flex items-center justify-between mt-5 pt-4"
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <p className="text-sm text-on-surface-variant">
                  {!range?.from && "Select your departure date"}
                  {range?.from && !range?.to && (
                    <span className="font-semibold text-primary">
                      Now select your return date
                    </span>
                  )}
                  {range?.from && range?.to && (
                    <>
                      <span className="font-semibold text-on-surface">
                        {nights} night{nights !== 1 ? "s" : ""}
                      </span>
                      <span className="text-on-surface-variant">
                        {" "}· {format(range.from, "d MMM")} – {format(range.to, "d MMM yyyy")}
                      </span>
                    </>
                  )}
                </p>

                <div className="flex items-center gap-3">
                  {(range?.from || range?.to) && (
                    <button
                      type="button"
                      onClick={() => { setRange(undefined); onChange("", ""); }}
                      className="text-sm text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm font-semibold text-white rounded-full px-5 py-2 transition-opacity hover:opacity-90"
                    style={{ background: "#0058be" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>

            {/* Click-away */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          </>
        )}
      </div>
    </>
  );
}
