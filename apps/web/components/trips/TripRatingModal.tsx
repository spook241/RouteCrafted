"use client";

import { useState } from "react";

interface TripRatingModalProps {
  tripId: string;
  currentRating?: number | null;
  currentComment?: string | null;
  onSaved?: (rating: number, comment: string) => void;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function TripRatingModal({
  tripId,
  currentRating,
  currentComment,
}: TripRatingModalProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(currentRating ?? 0);
  const [hovered, setHovered] = useState<number>(0);
  const [comment, setComment] = useState(currentComment ?? "");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayRating = hovered || rating;

  async function handleSave() {
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save rating.");
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 1200);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(true); setSaved(false); setError(null); }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: currentRating ? "'FILL' 1" : "'FILL' 0" }}>
          star
        </span>
        {currentRating ? `Rated ${currentRating}/5` : "Rate this trip"}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-3xl p-8 shadow-card-hover max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {saved ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-[48px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="font-headline font-bold text-on-surface text-xl mt-3">Rating saved!</p>
              </div>
            ) : (
              <>
                <h3 className="font-headline font-bold text-on-surface text-xl text-center mb-2">
                  How was your trip?
                </h3>
                <p className="text-sm text-on-surface-variant text-center mb-6">
                  Share your experience for this completed trip.
                </p>

                {/* Stars */}
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                    >
                      <span
                        className={`material-symbols-outlined text-[36px] transition-colors ${
                          star <= displayRating ? "text-[#f5a623]" : "text-outline-variant"
                        }`}
                        style={{ fontVariationSettings: star <= displayRating ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm font-semibold text-primary mb-6 h-5">
                  {displayRating ? STAR_LABELS[displayRating] : ""}
                </p>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any highlights or tips? (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-1"
                />
                <p className="text-xs text-on-surface-variant text-right mb-4">
                  {comment.length}/500
                </p>

                {error && (
                  <div className="flex items-center gap-2 bg-error/10 rounded-2xl px-4 py-3 mb-4">
                    <span className="material-symbols-outlined text-[14px] text-error">error</span>
                    <p className="text-sm text-error font-label">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-outline-variant rounded-full px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={loading || !rating}
                    className="flex-1 horizon-gradient text-white rounded-full px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    )}
                    Save rating
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
