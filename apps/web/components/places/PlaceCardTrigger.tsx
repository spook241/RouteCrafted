"use client";

import { useState } from "react";
import { PlaceCardModal } from "./PlaceCardModal";

interface PlaceCardTriggerData {
  id: string;
  name: string;
  category: string;
  verdict: string;
  summary: string;
  worthItReasons: string[];
  skipItReasons: string[];
  bestFor: string;
  costLevel: string;
  timeNeeded: string;
  imageUrl: string | null;
  rating: string | null;
  reviewCount: number | null;
  priceLevel: number | null;
  imageAttribution: string | null;
  imageIsExact: boolean;
}

const VERDICT_BADGE: Record<string, { label: string; classes: string }> = {
  worth_it: { label: "Details", classes: "bg-secondary/15 text-secondary border border-secondary/30" },
  skip_it: { label: "Skip It ✗", classes: "bg-error/10 text-error border border-error/30" },
  depends: { label: "Depends?", classes: "bg-tertiary-fixed/15 text-on-tertiary-fixed border border-tertiary-fixed/30" },
};

export function PlaceCardTrigger({ card }: { card: PlaceCardTriggerData }) {
  const [open, setOpen] = useState(false);
  const badge = VERDICT_BADGE[card.verdict] ?? VERDICT_BADGE.depends;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs font-label font-semibold px-2.5 py-1 rounded-full transition hover:opacity-80 ${badge.classes}`}
      >
        {badge.label}
      </button>
      {open && (
        <PlaceCardModal card={card} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
