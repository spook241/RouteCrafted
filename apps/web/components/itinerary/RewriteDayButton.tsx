'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RewriteDayButtonProps {
  tripId: string;
  dayId: string;
  disabled?: boolean;
}

export function RewriteDayButton({ tripId, dayId, disabled }: RewriteDayButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRewrite() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/itinerary/rewrite-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, dayId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Rewrite failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={handleRewrite}
        disabled={loading || disabled}
        className={`inline-flex items-center gap-2 text-sm horizon-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-headline font-bold rounded-full px-6 py-2.5 transition ${disabled ? 'hidden' : ''}`}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
              />
            </svg>
            Rewriting…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            Rewrite this day
          </>
        )}
      </button>
    </div>
  );
}
