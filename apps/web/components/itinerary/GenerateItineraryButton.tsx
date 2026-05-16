'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GenerationProgressModal,
  type TripInfo,
  type StepStates,
  type StreamedCard,
} from "./GenerationProgressModal";

const INITIAL_STEP_STATES: StepStates = {
  profile: 'pending',
  ai: 'pending',
  schedule: 'pending',
  research: 'pending',
  verdicts: 'pending',
  finalise: 'pending',
};

const FALLBACK_ERROR = 'Something went wrong � please try again in a few minutes.';

export function GenerateItineraryButton({
  tripId,
  trip,
}: {
  tripId: string;
  trip: TripInfo;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [stepStates, setStepStates] = useState<StepStates>(INITIAL_STEP_STATES);
  const [result, setResult] = useState<{ days: number; cards: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [cards, setCards] = useState<StreamedCard[]>([]);
  const [aiTokens, setAiTokens] = useState(0);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setStepStates({ ...INITIAL_STEP_STATES });
    setResult(null);
    setError(null);
    setTips([]);
    setCards([]);
    setAiTokens(0);
    setModalOpen(true);
    setGenerating(true);

    let localResult: { days: number; cards: number } | null = null;
    let localError: string | null = null;

    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId }),
      });

      // Non-SSE error (pre-stream: 401 / 404 / 409 etc.)
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        localError = String(body.error ?? FALLBACK_ERROR);
        setError(localError);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (data.type === 'step') {
              const step = String(data.step);
              const status = String(data.status) as 'pending' | 'active' | 'done';
              setStepStates((prev) => ({ ...prev, [step]: status }));
            } else if (data.type === 'complete') {
              localResult = {
                days: typeof data.days === 'number' ? data.days : 0,
                cards: typeof data.cards === 'number' ? data.cards : 0,
              };
              setResult(localResult);
              streamDone = true;
              break;
            } else if (data.type === 'tips') {
              if (Array.isArray(data.tips)) setTips(data.tips as string[]);
            } else if (data.type === 'ai_progress') {
              // Keep AI phase visibly active while large JSON is streaming.
              setStepStates((prev) =>
                prev.ai === 'done' ? prev : { ...prev, ai: 'active' },
              );
              if (typeof data.tokens === 'number') setAiTokens(data.tokens);
            } else if (data.type === 'card') {
              const c = data.card as StreamedCard;
              if (c?.id) setCards((prev) => [...prev, c]);
            } else if (data.type === 'error') {
              localError = String(data.message ?? FALLBACK_ERROR);
              setError(localError);
              streamDone = true;
              break;
            }
          } catch {
            // malformed SSE line � skip
          }
        }
      }

      // Stream ended without complete/error event
      if (!localResult && !localError) {
        localError = FALLBACK_ERROR;
        setError(localError);
      }
    } catch {
      localError = FALLBACK_ERROR;
      setError(localError);
    } finally {
      setGenerating(false);
    }
  }

  function handleDone() {
    setModalOpen(false);
    if (result !== null) {
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 horizon-gradient hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-headline font-bold rounded-full px-8 py-4 text-lg transition"
      >
        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
        Generate Itinerary
      </button>

      <GenerationProgressModal
        isOpen={modalOpen}
        trip={trip}
        stepStates={stepStates}
        result={result}
        error={error}
        tips={tips}
        cards={cards}
        aiTokens={aiTokens}
        onDone={handleDone}
      />
    </>
  );
}