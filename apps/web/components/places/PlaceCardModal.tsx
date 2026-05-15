"use client";

import { useEffect } from "react";

interface PlaceCardModalData {
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

const VERDICT_STYLES: Record<string, { label: string; icon: string; classes: string }> = {
  worth_it: { label: "Worth It", icon: "check_circle", classes: "bg-secondary/20 text-secondary" },
  skip_it: { label: "Skip It", icon: "cancel", classes: "bg-error/15 text-error" },
  depends: { label: "Depends", icon: "help", classes: "bg-tertiary-fixed/20 text-on-tertiary-fixed" },
};

const COST_ICONS: Record<string, string> = { free: "Free", low: "€", medium: "€€", high: "€€€" };
const PRICE_SYMBOLS = ["Free", "€", "€€", "€€€", "€€€€"];
const RATED_CATEGORIES = new Set(["restaurant", "cafe", "bar", "bakery", "hotel"]);

export function PlaceCardModal({
  card,
  onClose,
}: {
  card: PlaceCardModalData;
  onClose: () => void;
}) {
  const verdict = VERDICT_STYLES[card.verdict] ?? VERDICT_STYLES.depends;
  const ratingNum = card.rating != null ? parseFloat(card.rating) : null;
  const priceDisplay =
    RATED_CATEGORIES.has(card.category) && card.priceLevel != null
      ? (PRICE_SYMBOLS[card.priceLevel] ?? COST_ICONS[card.costLevel] ?? card.costLevel)
      : (COST_ICONS[card.costLevel] ?? card.costLevel);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        {card.imageUrl ? (
          <div className="relative h-48 overflow-hidden rounded-t-3xl">
            <img
              src={card.imageUrl}
              alt={card.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {card.imageAttribution && (
              <p className="absolute bottom-1 right-2 text-[9px] text-white/60 leading-tight text-right max-w-[80%] truncate">
                {card.imageAttribution}
              </p>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ) : (
          <div className="relative h-24 bg-surface-container-low rounded-t-3xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[48px] text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>
              place
            </span>
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-headline font-bold text-on-surface text-xl leading-snug">{card.name}</h2>
              <p className="text-xs font-label text-on-surface-variant capitalize mt-0.5">
                {card.category.replace(/_/g, " ")}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-label font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${verdict.classes}`}>
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{verdict.icon}</span>
              {verdict.label}
            </span>
          </div>

          {/* Summary */}
          <p className="text-on-surface-variant text-sm leading-relaxed">{card.summary}</p>

          {/* Worth It Reasons */}
          {card.worthItReasons.length > 0 && (
            <div>
              <p className="text-xs font-label font-semibold text-secondary mb-2 uppercase tracking-wider">Why it's worth it</p>
              <ul className="space-y-1.5">
                {card.worthItReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skip It Reasons */}
          {card.skipItReasons.length > 0 && (
            <div>
              <p className="text-xs font-label font-semibold text-error mb-2 uppercase tracking-wider">Consider skipping if</p>
              <ul className="space-y-1.5">
                {card.skipItReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-error">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-container-high">
            <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px]">payments</span>
              {priceDisplay}
            </span>
            {RATED_CATEGORIES.has(card.category) && ratingNum != null && (
              <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                {ratingNum.toFixed(1)}
                {card.reviewCount != null && (
                  <span className="text-on-surface-variant/60">({card.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
            <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {card.timeNeeded}
            </span>
            <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px]">person</span>
              {card.bestFor}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
