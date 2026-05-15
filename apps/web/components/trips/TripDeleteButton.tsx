"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TripDeleteButtonProps {
  tripId: string;
  /** Where to navigate after deletion. Defaults to /dashboard */
  redirectTo?: string;
  /** Visual variant: "icon" (small, for card overlay) or "button" (full, for detail page) */
  variant?: "icon" | "button";
}

export function TripDeleteButton({
  tripId,
  redirectTo = "/dashboard",
  variant = "button",
}: TripDeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();          // invalidate server-component cache
        router.replace(redirectTo); // navigate to dashboard
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          aria-label="Delete trip"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(true);
          }}
          className="w-8 h-8 rounded-full bg-error/90 text-on-error flex items-center justify-center shadow hover:bg-error transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>

        {confirming && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false); }}
          >
            <div
              className="bg-surface-container-lowest rounded-3xl p-8 shadow-card-hover max-w-sm w-full mx-4"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-error text-[28px]">delete_forever</span>
              </div>
              <h3 className="font-headline font-bold text-on-surface text-xl text-center mb-2">Delete trip?</h3>
              <p className="text-sm text-on-surface-variant text-center mb-6">
                This will permanently delete the trip and all its itinerary data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                  className="flex-1 border border-outline-variant rounded-full px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
                  disabled={loading}
                  className="flex-1 bg-error text-on-error rounded-full px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // "button" variant for detail page
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-error/50 text-error text-sm font-semibold hover:bg-error/10 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
        Delete Trip
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-3xl p-8 shadow-card-hover max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-[28px]">delete_forever</span>
            </div>
            <h3 className="font-headline font-bold text-on-surface text-xl text-center mb-2">Delete trip?</h3>
            <p className="text-sm text-on-surface-variant text-center mb-6">
              This will permanently delete the trip and all its itinerary data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 border border-outline-variant rounded-full px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={loading}
                className="flex-1 bg-error text-on-error rounded-full px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
