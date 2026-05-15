"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateRangePicker } from "./DateRangePicker";

type Trip = {
  id: string;
  destination: string;
  country: string;
  lat?: string | null;
  long?: string | null;
  startDate: string;
  endDate: string;
  budgetRange: string;
  travelStyle: string;
  groupType: string;
  pacing: string;
  status: string;
};

interface TripEditPanelProps {
  trip: Trip;
  hasItinerary: boolean;
  onClose: () => void;
}

const LABEL_CLASS =
  "block text-xs font-label font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider";
const SELECT_CLASS =
  "w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary";

export function TripEditPanel({ trip, hasItinerary, onClose }: TripEditPanelProps) {
  const router = useRouter();

  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [budgetRange, setBudgetRange] = useState(trip.budgetRange);
  const [travelStyle, setTravelStyle] = useState(trip.travelStyle);
  const [groupType, setGroupType] = useState(trip.groupType);
  const [pacing, setPacing] = useState(trip.pacing);

  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datesChanged = startDate !== trip.startDate || endDate !== trip.endDate;
  const needsClearConfirm = hasItinerary && datesChanged;
  const saveBlocked = needsClearConfirm && !clearConfirmed;

  async function handleSave() {
    if (saveBlocked) return;
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, budgetRange, travelStyle, groupType, pacing }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save.");
        return;
      }

      // If dates changed and user confirmed, clear the itinerary
      if (datesChanged && hasItinerary && clearConfirmed) {
        const delRes = await fetch(`/api/trips/${trip.id}/itinerary`, {
          method: "DELETE",
        });
        if (!delRes.ok) {
          setError("Trip saved but failed to clear itinerary. Please refresh.");
          return;
        }
      }

      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-surface shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <h2 className="text-lg font-headline font-bold text-on-surface">Edit Trip Details</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container transition"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Destination note */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-label text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Destination cannot be changed after trip creation.
          </p>
          <p className="text-sm font-label font-semibold text-on-surface mt-1">
            {trip.destination}{trip.country ? `, ${trip.country}` : ""}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Dates */}
          <div>
            <label className={LABEL_CLASS}>Travel dates</label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
                setClearConfirmed(false); // reset confirmation when dates change again
              }}
              lat={trip.lat ?? null}
              lon={trip.long ?? null}
            />
          </div>

          {/* Itinerary clear warning */}
          {needsClearConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
                <p className="text-sm font-label text-amber-800">
                  Changing the dates will clear your generated itinerary. Your saved place cards won&apos;t be affected.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearConfirmed}
                  onChange={(e) => setClearConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600"
                />
                <span className="text-xs font-label font-semibold text-amber-800">
                  I understand — clear my itinerary
                </span>
              </label>
            </div>
          )}

          {/* Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Budget</label>
              <select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} className={SELECT_CLASS}>
                <option value="budget">Budget</option>
                <option value="mid">Mid-range</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Travel style</label>
              <select value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)} className={SELECT_CLASS}>
                <option value="cultural">Cultural</option>
                <option value="adventure">Adventure</option>
                <option value="relaxation">Relaxation</option>
                <option value="foodie">Foodie</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Group type</label>
              <select value={groupType} onChange={(e) => setGroupType(e.target.value)} className={SELECT_CLASS}>
                <option value="solo">Solo</option>
                <option value="couple">Couple</option>
                <option value="family">Family</option>
                <option value="friends">Friends</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Pacing</label>
              <select value={pacing} onChange={(e) => setPacing(e.target.value)} className={SELECT_CLASS}>
                <option value="relaxed">Relaxed</option>
                <option value="moderate">Moderate</option>
                <option value="packed">Packed</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-error/10 rounded-2xl px-4 py-3">
              <span className="material-symbols-outlined text-[16px] text-error mt-0.5">error</span>
              <p className="text-sm text-error font-label">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-outline-variant rounded-full px-4 py-3 text-sm font-label font-semibold text-on-surface-variant hover:bg-surface-container transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saveBlocked}
            className="flex-1 horizon-gradient hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-label font-semibold rounded-full px-4 py-3 text-sm transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
