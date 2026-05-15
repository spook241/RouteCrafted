"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ItineraryStaleBannerProps {
  tripId: string;
}

export function ItineraryStaleBanner({ tripId }: ItineraryStaleBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  async function handleDismiss() {
    setLoading(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itineraryStale: false }),
      });
      setDismissed(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
      <span className="material-symbols-outlined text-[20px] text-amber-600 mt-0.5 shrink-0">info</span>
      <p className="flex-1 text-sm font-label text-amber-800">
        Your itinerary was generated with different preferences. Consider rewriting individual days to reflect your updates.
      </p>
      <button
        onClick={handleDismiss}
        disabled={loading}
        aria-label="Dismiss"
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-amber-100 transition disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[16px] text-amber-600">close</span>
      </button>
    </div>
  );
}
