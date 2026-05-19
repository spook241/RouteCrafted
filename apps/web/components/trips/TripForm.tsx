"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBox } from "@mapbox/search-js-react";
import type { SearchBoxRetrieveResponse } from "@mapbox/search-js-core";
import { DateRangePicker } from "./DateRangePicker";

const SELECT_CLASS =
  "w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS = "block text-xs font-label font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider";

export function TripForm({ initialDestination = "", initialCountry = "" }: { initialDestination?: string; initialCountry?: string; }) {
  const router = useRouter();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const [destination, setDestination] = useState(initialDestination);
  const [country, setCountry] = useState(initialCountry);
  const [lat, setLat] = useState<string | null>(null);
  const [long, setLong] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetRange, setBudgetRange] = useState("mid");
  const [travelStyle, setTravelStyle] = useState("cultural");
  const [groupType, setGroupType] = useState("solo");
  const [pacing, setPacing] = useState("moderate");
  const [userNotes, setUserNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleRetrieve(res: SearchBoxRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    setDestination(feature.properties.name);
    const ctx = feature.properties.context as {
      country?: { name: string };
    } | undefined;
    setCountry(ctx?.country?.name ?? "");
    const coords = feature.geometry.coordinates;
    setLat(String(coords[1]));
    setLong(String(coords[0]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!destination) {
      setError("Please select a destination using the search box.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          country,
          lat,
          long,
          startDate,
          endDate,
          budgetRange,
          travelStyle,
          groupType,
          pacing,
          userNotes: userNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create trip.");
        return;
      }

      const trip = (await res.json()) as { id: string };
      router.push(`/trips/${trip.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-container-lowest rounded-3xl p-8 shadow-card space-y-6"
    >
      {/* Destination */}
      <div>
        <label className={LABEL_CLASS}>Destination</label>
        <SearchBox
          accessToken={token}
          onRetrieve={handleRetrieve}
          options={{ language: "en", types: "place,locality,district,region,country" }}
          theme={{
            variables: {
              colorBackground: "#f0f3ff",
              colorBackgroundHover: "#dee8ff",
              colorText: "#111c2d",
              colorSecondary: "#424754",
              border: "none",
              borderRadius: "1rem",
              fontFamily: "inherit",
            },
          }}
          value={destination}
        />
        {destination && (
          <p className="mt-2 text-xs font-label text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            {destination}{country ? `, ${country}` : ""}
          </p>
        )}
      </div>

      {/* Dates */}
      <div>
        <label className={LABEL_CLASS}>Travel dates</label>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          lat={lat}
          lon={long}
        />
      </div>

      {/* Preferences grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Budget</label>
          <select
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="budget">Budget</option>
            <option value="mid">Mid-range</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Travel style</label>
          <select
            value={travelStyle}
            onChange={(e) => setTravelStyle(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="cultural">Cultural</option>
            <option value="adventure">Adventure</option>
            <option value="relaxation">Relaxation</option>
            <option value="foodie">Foodie</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Group type</label>
          <select
            value={groupType}
            onChange={(e) => setGroupType(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="solo">Solo</option>
            <option value="couple">Couple</option>
            <option value="family">Family</option>
            <option value="friends">Friends</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Pacing</label>
          <select
            value={pacing}
            onChange={(e) => setPacing(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="relaxed">Relaxed</option>
            <option value="moderate">Moderate</option>
            <option value="packed">Packed</option>
          </select>
        </div>
      </div>

      {/* Special requests */}
      <div>
        <label className={LABEL_CLASS}>
          Special requests
          <span className="ml-1 font-normal normal-case tracking-normal text-on-surface-variant/60">(optional)</span>
        </label>
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="e.g. I must visit the Sagrada Família, skip large crowds, include a day trip to Montserrat…"
          className="w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-on-surface-variant/50"
        />
        <p className="mt-1 text-right text-[11px] font-label text-on-surface-variant/60">
          {userNotes.length}/500
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-error/10 rounded-2xl px-4 py-3">
          <span className="material-symbols-outlined text-[16px] text-error mt-0.5">error</span>
          <p className="text-sm text-error font-label">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full horizon-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-headline font-bold rounded-full px-6 py-4 text-base transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            Creating trip…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Craft my itinerary
          </>
        )}
      </button>
    </form>
  );
}
