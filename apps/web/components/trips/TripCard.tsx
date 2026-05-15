"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { TripDeleteButton } from "./TripDeleteButton";

type Trip = {
  id: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  status: string;
  budgetRange: string;
  travelStyle: string;
  pacing: string;
  coverImageUrl?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-container-high text-on-surface-variant",
  active: "bg-primary-container text-on-primary",
  completed: "bg-secondary text-on-secondary",
  planned: "bg-tertiary-fixed text-on-tertiary-fixed",
};

function chipLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function TripCard({
  trip,
  alertCount = 0,
}: {
  trip: Trip;
  alertCount?: number;
}) {
  const router = useRouter();
  const isCompleted = trip.status === "completed";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/trips/${trip.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/trips/${trip.id}`); }}
      className={`cursor-pointer bg-surface-container-lowest rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow group relative${isCompleted ? " opacity-75" : ""}`}
    >
      {/* Cover image */}
      <div className="relative h-48 w-full bg-surface-container-low overflow-hidden">
        {trip.coverImageUrl ? (
          <Image
            src={trip.coverImageUrl}
            alt={`${trip.destination} cover`}
            fill
            className={`object-cover transition-transform duration-700 group-hover:scale-105${isCompleted ? " grayscale" : ""}`}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[64px] text-outline-variant">map</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-on-surface/40 to-transparent" />
        {/* Status badge */}
        <span className={`absolute top-4 left-4 text-xs font-label font-semibold px-3 py-1 rounded-full ${
          STATUS_STYLES[trip.status] ?? STATUS_STYLES.draft
        }`}>
          {chipLabel(trip.status)}
        </span>
        {/* Delete button — stop propagation so the card click doesn't fire */}
        <div
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <TripDeleteButton tripId={trip.id} variant="icon" />
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors">
              {trip.destination}
            </h3>
            <p className="text-sm text-on-surface-variant">{trip.country}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {alertCount > 0 && (
              <span className="text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-2.5 py-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {alertCount}
              </span>
            )}
            <span className="sr-only">{chipLabel(trip.status)}</span>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant mb-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>

        <div className="flex flex-wrap gap-2">
          {[trip.budgetRange, trip.travelStyle, trip.pacing].map((tag) => (
            <span
              key={tag}
              className="text-xs bg-surface-container-low text-on-surface-variant rounded-full px-3 py-1 font-label font-medium"
            >
              {chipLabel(tag)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
