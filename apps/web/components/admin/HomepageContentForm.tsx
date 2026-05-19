"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TrendingDestination {
  id: string;
  destination: string;
  country: string;
  imageUrl: string;
  tagline: string;
  span: "wide" | "narrow";
}

export interface HomepageData {
  caption: string;
  hero_headline: string;
  hero_subheadline: string;
  curator_tip_text: string;
  cta_text: string;
  feature_badges: string[];
  destinations: TrendingDestination[];
}

export function HomepageContentForm({ 
  initialData 
}: { 
  initialData: HomepageData
}) {
  const router = useRouter();
  const [data, setData] = useState<HomepageData>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateField = (field: keyof HomepageData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const addDestination = () => {
    setData(prev => ({
      ...prev,
      destinations: [
        ...prev.destinations,
        {
          id: crypto.randomUUID(),
          destination: "",
          country: "",
          imageUrl: "",
          tagline: "",
          span: "narrow"
        }
      ]
    }));
  };

  const removeDestination = (id: string) => {
    setData(prev => ({
      ...prev,
      destinations: prev.destinations.filter(d => d.id !== id)
    }));
  };

  const updateDestination = (id: string, field: keyof TrendingDestination, value: string) => {
    setData(prev => ({
      ...prev,
      destinations: prev.destinations.map(d => d.id === id ? { ...d, [field]: value } : d)
    }));
  };

  const addBadge = () => {
    setData(prev => ({
      ...prev,
      feature_badges: [...prev.feature_badges, "New Badge"]
    }));
  };

  const updateBadge = (index: number, value: string) => {
    setData(prev => {
      const newBadges = [...prev.feature_badges];
      newBadges[index] = value;
      return { ...prev, feature_badges: newBadges };
    });
  };

  const removeBadge = (index: number) => {
    setData(prev => ({
      ...prev,
      feature_badges: prev.feature_badges.filter((_, i) => i !== index)
    }));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to save content");
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      
      {/* Hero Section */}
      <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card space-y-6">
        <label className="block text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider">
          Hero Section
        </label>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Headline</label>
            <input
              type="text"
              value={data.hero_headline}
              onChange={(e) => updateField('hero_headline', e.target.value)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm font-headline focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Subheadline</label>
            <textarea
              value={data.hero_subheadline}
              onChange={(e) => updateField('hero_subheadline', e.target.value)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Curator's Tip Text</label>
            <textarea
              value={data.curator_tip_text}
              onChange={(e) => updateField('curator_tip_text', e.target.value)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">CTA Button Text</label>
            <input
              type="text"
              value={data.cta_text}
              onChange={(e) => updateField('cta_text', e.target.value)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>
      </div>

      {/* Feature Badges Section */}
      <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider">
            Feature Badges
          </label>
          <button
            type="button"
            onClick={addBadge}
            className="flex items-center gap-1 text-sm font-label font-bold text-primary hover:text-primary-container transition"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Badge
          </button>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {data.feature_badges.map((badge, index) => (
            <div key={index} className="flex items-center gap-1 bg-surface-container-low rounded-full pl-4 pr-1 py-1 border border-surface-container">
              <input
                type="text"
                value={badge}
                onChange={(e) => updateBadge(index, e.target.value)}
                className="bg-transparent text-sm font-label focus:outline-none w-32"
                required
              />
              <button
                type="button"
                onClick={() => removeBadge(index)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-error hover:bg-error/10 transition"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
          {data.feature_badges.length === 0 && (
            <p className="text-sm text-on-surface-variant py-2">No badges added.</p>
          )}
        </div>
      </div>

      {/* Trending Section */}
      <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card space-y-6">
        <div>
          <label className="block text-xs font-label font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
            Trending Caption
          </label>
          <input
            type="text"
            value={data.caption}
            onChange={(e) => updateField('caption', e.target.value)}
            className="w-full bg-surface-container-low rounded-2xl px-4 py-3 text-on-surface text-sm font-label focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="pt-4 border-t border-surface-container-high">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider">
              Trending Destinations
            </label>
            <button
              type="button"
              onClick={addDestination}
              className="flex items-center gap-1 text-sm font-label font-bold text-primary hover:text-primary-container transition"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Card
            </button>
          </div>

          <div className="space-y-6">
            {data.destinations.map((dest, index) => (
              <div key={dest.id} className="bg-surface-container-low rounded-2xl p-5 border border-surface-container relative">
                <div className="absolute top-4 right-4">
                  <button
                    type="button"
                    onClick={() => removeDestination(dest.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-error hover:bg-error/10 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                
                <p className="text-xs font-label font-bold text-on-surface-variant mb-4">Card {index + 1}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Destination (City)</label>
                    <input
                      type="text"
                      value={dest.destination}
                      onChange={(e) => updateDestination(dest.id, 'destination', e.target.value)}
                      className="w-full bg-surface-container rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Country</label>
                    <input
                      type="text"
                      value={dest.country}
                      onChange={(e) => updateDestination(dest.id, 'country', e.target.value)}
                      className="w-full bg-surface-container rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Tagline</label>
                    <input
                      type="text"
                      value={dest.tagline}
                      onChange={(e) => updateDestination(dest.id, 'tagline', e.target.value)}
                      className="w-full bg-surface-container rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Image URL (Leave blank to auto-generate)</label>
                    <input
                      type="url"
                      value={dest.imageUrl}
                      onChange={(e) => updateDestination(dest.id, 'imageUrl', e.target.value)}
                      placeholder="e.g. https://images.unsplash.com/..."
                      className="w-full bg-surface-container rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-label font-medium text-on-surface-variant mb-1">Layout Size</label>
                    <select
                      value={dest.span}
                      onChange={(e) => updateDestination(dest.id, 'span', e.target.value as "wide" | "narrow")}
                      className="w-full bg-surface-container rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="wide">Wide (2/3 width)</option>
                      <option value="narrow">Narrow (1/3 width)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {error && (
            <div className="flex items-start gap-2 bg-error/10 rounded-2xl px-4 py-3 max-w-md">
              <span className="material-symbols-outlined text-[16px] text-error mt-0.5">error</span>
              <p className="text-sm text-error font-label">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="flex items-start gap-2 bg-secondary/10 rounded-2xl px-4 py-3 max-w-md">
              <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-sm text-secondary font-label">Content saved successfully!</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="horizon-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-headline font-bold rounded-full px-8 py-3.5 text-sm transition"
        >
          {saving ? "Saving..." : "Save Content"}
        </button>
      </div>
    </form>
  );
}
