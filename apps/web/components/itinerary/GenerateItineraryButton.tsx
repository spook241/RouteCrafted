'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Each stage: [elapsed ms to reach this stage, target progress %, label]
const STAGES: [number, number, string][] = [
  [0,     5,  "Reading your trip details…"],
  [3000,  30, "Building your day-by-day plan…"],
  [9000,  52, "Selecting activities & experiences…"],
  [16000, 70, "Optimising timing & pace…"],
  [23000, 85, "Adding finishing touches…"],
  [29000, 93, "Almost there…"],
];

export function GenerateItineraryButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startProgress() {
    startRef.current = Date.now();
    setProgress(0);
    setStage(STAGES[0][2]);

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;

      // Find which stage we're in
      let currentStage = STAGES[STAGES.length - 1];
      let nextStage: [number, number, string] | null = null;
      for (let i = 0; i < STAGES.length; i++) {
        if (elapsed >= STAGES[i][0]) {
          currentStage = STAGES[i];
          nextStage = STAGES[i + 1] ?? null;
        } else {
          break;
        }
      }

      setStage(currentStage[2]);

      // Interpolate progress between current and next stage
      if (nextStage) {
        const segmentElapsed = elapsed - currentStage[0];
        const segmentDuration = nextStage[0] - currentStage[0];
        const t = Math.min(segmentElapsed / segmentDuration, 1);
        const interpolated = currentStage[1] + t * (nextStage[1] - currentStage[1]);
        setProgress(Math.round(interpolated));
      } else {
        setProgress(currentStage[1]);
      }
    }, 120);
  }

  function stopProgress(success: boolean) {
    if (tickRef.current) clearInterval(tickRef.current);
    if (success) {
      setProgress(100);
      setStage("Your itinerary is ready! ✨");
    }
  }

  useEffect(() => {
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    startProgress();
    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        stopProgress(false);
        setError(body.error ?? `Generation failed (${res.status})`);
        return;
      }
      stopProgress(true);
      // Short pause so user sees 100% before refresh
      await new Promise((r) => setTimeout(r, 600));
      router.refresh();
    } catch {
      stopProgress(false);
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-center flex flex-col items-center gap-4">
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 horizon-gradient hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-on-primary font-headline font-bold rounded-full px-8 py-4 text-lg transition"
      >
        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
        {loading ? "Generating…" : "Generate Itinerary"}
      </button>

      {loading && (
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          {/* Track */}
          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full horizon-gradient transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Label + percentage */}
          <div className="flex items-center justify-between w-full text-xs text-on-surface-variant">
            <span>{stage}</span>
            <span className="font-mono font-semibold">{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
