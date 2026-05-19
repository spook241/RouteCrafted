"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  tripId: string;
  hasItinerary: boolean;
  disabled?: boolean;
}

export function GeneratePlaceCardsButton({ tripId, hasItinerary, disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!hasItinerary) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/places/generate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          (body as { error?: string }).error ?? "Failed to generate cards",
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (!hasItinerary) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading || disabled}
        className={`inline-flex items-center gap-2 horizon-gradient hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-on-primary text-sm font-headline font-bold px-6 py-2.5 rounded-full transition ${disabled ? 'hidden' : ''}`}
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block material-symbols-outlined text-[16px]">autorenew</span>
            Generating…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            Generate Place Cards
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
