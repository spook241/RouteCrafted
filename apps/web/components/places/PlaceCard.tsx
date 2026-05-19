"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PlaceCardData {
  id: string;
  tripId: string;
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
  flagged: boolean;
  // enrichment
  rating: string | null;      // Drizzle numeric → string
  reviewCount: number | null;
  priceLevel: number | null;
  imageAttribution: string | null;
  imageIsExact: boolean;
}

const VERDICT_STYLES: Record<string, { label: string; icon: string; classes: string }> = {
  worth_it: {
    label: "Worth It",
    icon: "check_circle",
    classes: "bg-secondary/20 text-secondary",
  },
  skip_it: {
    label: "Skip It",
    icon: "cancel",
    classes: "bg-error/15 text-error",
  },
  depends: {
    label: "Depends",
    icon: "help",
    classes: "bg-tertiary-fixed/20 text-on-tertiary-fixed",
  },
};

const COST_ICONS: Record<string, string> = {
  free: "Free",
  low: "€",
  medium: "€€",
  high: "€€€",
};

// Enriched price level symbols (index = priceLevel int 0-4)
const PRICE_SYMBOLS = ["Free", "€", "€€", "€€€", "€€€€"];

// Categories that get real star ratings from enrichment providers
const RATED_CATEGORIES = new Set(["restaurant", "cafe", "bar", "bakery", "hotel"]);

export function PlaceCard({
  card,
  scheduledDay,
  scheduledTime,
  tripId,
  isLocked,
}: {
  card: PlaceCardData;
  scheduledDay?: number | null;
  scheduledTime?: string | null;
  tripId?: string;
  isLocked?: boolean;
}) {
  const router = useRouter();
  const [flagging, setFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const verdict = VERDICT_STYLES[card.verdict] ?? VERDICT_STYLES.depends;

  // Parse numeric rating string from DB (Drizzle returns numeric as string)
  const ratingNum = card.rating != null ? parseFloat(card.rating) : null;

  // Use enriched priceLevel for food/hotel when available, fall back to AI costLevel
  const priceDisplay =
    RATED_CATEGORIES.has(card.category) && card.priceLevel != null
      ? (PRICE_SYMBOLS[card.priceLevel] ?? COST_ICONS[card.costLevel] ?? card.costLevel)
      : (COST_ICONS[card.costLevel] ?? card.costLevel);

  async function handleFlag() {
    if (!flagReason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/places/flag/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: flagReason }),
      });
      if (res.ok) {
        setShowFlagForm(false);
        setFlagReason("");
        router.refresh();
      }
    } finally {
      setLoading(false);
      setFlagging(false);
    }
  }

  async function handleSwap() {
    setSwapping(true);
    setSwapError(null);
    try {
      const res = await fetch(`/api/places/${card.id}/swap`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setSwapError(data.error ?? "Swap failed");
      }
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow flex flex-col group">
      {/* Image or placeholder */}
      {card.imageUrl ? (
        <div className="relative h-36 overflow-hidden">
          <img
            src={card.imageUrl}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {card.imageAttribution && (
            <p className="absolute bottom-1 right-2 text-[9px] text-white/60 leading-tight text-right max-w-[80%] truncate">
              {card.imageAttribution}
            </p>
          )}
        </div>
      ) : (
        <div className="w-full h-36 bg-surface-container-low flex items-center justify-center">
          <span className="material-symbols-outlined text-[48px] text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>
            {categoryMaterialIcon(card.category)}
          </span>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-headline font-bold text-on-surface text-base leading-snug">
              {card.name}
            </h3>
            <p className="text-xs font-label text-on-surface-variant capitalize mt-0.5">
              {card.category.replace(/_/g, " ")}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-label font-semibold px-3 py-1 rounded-full flex items-center gap-1 ${verdict.classes}`}>
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{verdict.icon}</span>
            {verdict.label}
          </span>
        </div>

        {/* Summary */}
        <p className="text-on-surface-variant text-xs leading-relaxed">{card.summary}</p>

        {/* Reasons */}
        {card.worthItReasons.length > 0 && (
          <ul className="space-y-1">
            {card.worthItReasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-secondary">
                <span className="material-symbols-outlined text-[12px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        {card.skipItReasons.length > 0 && (
          <ul className="space-y-1">
            {card.skipItReasons.slice(0, 2).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-error">
                <span className="material-symbols-outlined text-[12px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
          {/* Day/time chip — links to the day detail page */}
          {scheduledDay != null && scheduledTime && tripId && (
            <Link
              href={`/trips/${tripId}/day/${scheduledDay}`}
              className="text-xs font-label bg-primary/10 text-primary px-2.5 py-0.5 rounded-full flex items-center gap-1 hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
              Day {scheduledDay} · {scheduledTime.charAt(0).toUpperCase() + scheduledTime.slice(1)}
            </Link>
          )}
          <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[11px]">payments</span>
            {priceDisplay}
          </span>
          {RATED_CATEGORIES.has(card.category) && ratingNum != null && (
            <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {ratingNum.toFixed(1)}
              {card.reviewCount != null && (
                <span className="text-on-surface-variant/60">({card.reviewCount.toLocaleString()})</span>
              )}
            </span>
          )}
          <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[11px]">schedule</span>
            {card.timeNeeded}
          </span>
          <span className="text-xs font-label bg-surface-container-low text-on-surface-variant px-2.5 py-0.5 rounded-full truncate max-w-32 flex items-center gap-1">
            <span className="material-symbols-outlined text-[11px]">person</span>
            {card.bestFor}
          </span>
        </div>

        {/* Flag section */}
        {!showFlagForm ? (
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => setShowFlagForm(true)}
              className="text-xs font-label text-on-surface-variant hover:text-on-surface transition text-left flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">flag</span>
              Report inaccuracy
            </button>
            {!isLocked && (
              <button
                onClick={handleSwap}
                disabled={swapping}
                title="Swap for another activity"
                className="ml-auto text-xs font-label text-on-surface-variant hover:text-primary transition flex items-center gap-1 disabled:opacity-50"
              >
                {swapping ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                )}
                Swap
              </button>
            )}
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="What's inaccurate?"
              rows={2}
              maxLength={500}
              className="w-full text-xs bg-surface-container-low rounded-2xl px-3 py-2 text-on-surface placeholder-on-surface-variant resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={handleFlag}
                disabled={loading || !flagReason.trim()}
                className="text-xs font-label bg-error/10 text-error hover:bg-error/20 px-4 py-1.5 rounded-full disabled:opacity-50 transition"
              >
                {loading ? "Reporting…" : "Report"}
              </button>
              <button
                onClick={() => {
                  setShowFlagForm(false);
                  setFlagReason("");
                }}
                className="text-xs font-label text-on-surface-variant hover:text-on-surface transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {swapError && (
          <p className="text-xs text-error mt-1">{swapError}</p>
        )}
      </div>
    </div>
  );
}

function categoryMaterialIcon(category: string): string {
  const map: Record<string, string> = {
    museum: "museum",
    restaurant: "restaurant",
    park: "park",
    religious_site: "church",
    historic: "castle",
    nature: "forest",
    shopping: "shopping_bag",
    attraction: "attractions",
  };
  return map[category] ?? "place";
}
