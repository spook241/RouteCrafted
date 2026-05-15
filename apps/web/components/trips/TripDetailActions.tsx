"use client";

import { useState } from "react";
import { TripEditPanel } from "./TripEditPanel";

type Trip = {
  id: string;
  destination: string;
  country: string;
  lat?: string | null;
  long?: string | null;
  startDate: string;
  endDate: string;
  budgetRange: string;
  travelStyle: string;
  groupType: string;
  pacing: string;
  status: string;
};

interface TripDetailActionsProps {
  trip: Trip;
  hasItinerary: boolean;
}

export function TripDetailActions({ trip, hasItinerary }: TripDetailActionsProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Don't allow editing completed trips
  if (trip.status === "completed") return null;

  return (
    <>
      <button
        onClick={() => setIsEditing(true)}
        aria-label="Edit trip details"
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition"
        title="Edit trip details"
      >
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
      </button>

      {isEditing && (
        <TripEditPanel
          trip={trip}
          hasItinerary={hasItinerary}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
}
