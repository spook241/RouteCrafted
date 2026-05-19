"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface TripCoverUploadProps {
  tripId: string;
  currentUrl: string | null;
  isLocked?: boolean;
}

export function TripCoverUpload({ tripId, currentUrl, isLocked }: TripCoverUploadProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/refresh-cover`, { method: "POST" });
      if (!res.ok) throw new Error("Could not find a photo for this destination");
      const { coverImageUrl } = await res.json() as { coverImageUrl: string };
      setPreview(coverImageUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (isLocked) {
    if (!currentUrl) return null;
    return (
      <div className="relative w-full h-52 rounded-3xl overflow-hidden bg-surface-container-low">
        <Image src={currentUrl} alt="Trip cover" fill className="object-cover" unoptimized />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative w-full h-52 rounded-3xl overflow-hidden bg-surface-container-low">
        {preview ? (
          <Image
            src={preview}
            alt="Trip cover"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="material-symbols-outlined text-[40px] text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
            <span className="text-sm font-label text-on-surface-variant">No cover photo</span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-label text-error mt-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh AI photo"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 hover:bg-white text-on-surface shadow transition disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[14px] ${refreshing ? "animate-spin" : ""}`}>
            {refreshing ? "progress_activity" : "auto_awesome"}
          </span>
          {refreshing ? "Finding photo…" : "Refresh AI photo"}
        </button>
      </div>
    </div>
  );
}

