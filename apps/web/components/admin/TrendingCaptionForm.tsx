"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrendingCaptionForm({ initialCaption }: { initialCaption: string }) {
  const router = useRouter();
  const [caption, setCaption] = useState(initialCaption);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/trending-caption", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: caption }),
      });

      if (!res.ok) {
        throw new Error("Failed to save caption");
      }

      setSuccess(true);
      router.refresh(); // Refresh the page to reflect new state
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-surface-container-lowest rounded-3xl p-8 shadow-card space-y-6">
      <div>
        <label className="block text-xs font-label font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
          Trending Caption
        </label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Trending right now"
          className="w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={100}
          required
        />
        <p className="mt-2 text-xs text-on-surface-variant">
          This text appears above the destination cards on the homepage.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-error/10 rounded-2xl px-4 py-3">
          <span className="material-symbols-outlined text-[16px] text-error mt-0.5">error</span>
          <p className="text-sm text-error font-label">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="flex items-start gap-2 bg-secondary/10 rounded-2xl px-4 py-3">
          <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-sm text-secondary font-label">Caption saved successfully!</p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="horizon-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-headline font-bold rounded-full px-6 py-3 text-sm transition"
      >
        {saving ? "Saving..." : "Save Caption"}
      </button>
    </form>
  );
}
