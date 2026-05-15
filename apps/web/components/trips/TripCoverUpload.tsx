"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface TripCoverUploadProps {
  tripId: string;
  currentUrl: string | null;
}

export function TripCoverUpload({ tripId, currentUrl }: TripCoverUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tripId", tripId);

      const res = await fetch("/api/upload/trip-cover", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(msg as string);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(currentUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative w-full h-52 rounded-3xl overflow-hidden bg-surface-container-low hover:bg-surface-container-high transition focus:outline-none"
        aria-label="Upload trip cover image"
      >
        {preview ? (
          <Image
            src={preview}
            alt="Trip cover"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="material-symbols-outlined text-[40px] text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>add_photo_alternate</span>
            <span className="text-sm font-label text-on-surface-variant">Add cover photo</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
          <span className="text-white text-sm font-label font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            {uploading ? "Uploading…" : preview ? "Change cover" : "Upload cover"}
          </span>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

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
          disabled={refreshing || uploading}
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
