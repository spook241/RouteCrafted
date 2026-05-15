import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { itineraryDays, itineraryItems, trips } from "@/lib/db/schema";

// ─── Days ─────────────────────────────────────────────────────────────────────

export async function getDaysByTrip(tripId: string) {
  return db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.tripId, tripId))
    .orderBy(asc(itineraryDays.dayNumber));
}

export async function getDayByNumber(tripId: string, dayNumber: number) {
  const rows = await db
    .select()
    .from(itineraryDays)
    .where(
      and(
        eq(itineraryDays.tripId, tripId),
        eq(itineraryDays.dayNumber, dayNumber),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getDayWithItems(tripId: string, dayNumber: number) {
  const day = await getDayByNumber(tripId, dayNumber);
  if (!day) return null;
  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.dayId, day.id))
    .orderBy(asc(itineraryItems.position));
  return { ...day, items };
}

// ─── Inserts ──────────────────────────────────────────────────────────────────

export async function insertDays(
  rows: {
    tripId: string;
    dayNumber: number;
    date: string;
    theme: string;
    summary: string;
  }[],
) {
  return db.insert(itineraryDays).values(rows).returning();
}

export async function insertItems(
  rows: {
    dayId: string;
    position: number;
    timeBlock: string;
    type: string;
    category?: string | null;
    title: string;
    description: string;
    location: string;
    durationMins: number;
    estimatedCost: string;
    isOptional: boolean;
  }[],
) {
  return db.insert(itineraryItems).values(rows).returning();
}

// ─── Updates ──────────────────────────────────────────────────────────────────

export async function updateDay(
  dayId: string,
  data: Partial<{
    theme: string;
    summary: string;
    weatherCode: number;
    weatherLabel: string;
    weatherAlerted: boolean;
    rewrittenAt: Date;
  }>,
) {
  const rows = await db
    .update(itineraryDays)
    .set(data)
    .where(eq(itineraryDays.id, dayId))
    .returning();
  return rows[0] ?? null;
}

export async function updateItem(
  id: string,
  userId: string,
  data: Partial<{
    timeBlock: string;
    type: string;
    title: string;
    description: string;
    location: string;
    durationMins: number;
    estimatedCost: string;
    isOptional: boolean;
  }>,
) {
  // Ownership guard via JOIN: item → day → trip → user
  const [item] = await db
    .select({ itemId: itineraryItems.id })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
    .innerJoin(trips, eq(itineraryDays.tripId, trips.id))
    .where(and(eq(itineraryItems.id, id), eq(trips.userId, userId)))
    .limit(1);
  if (!item) return null;

  const rows = await db
    .update(itineraryItems)
    .set(data)
    .where(eq(itineraryItems.id, id))
    .returning();
  return rows[0] ?? null;
}

// ─── Deletes ──────────────────────────────────────────────────────────────────

export async function deleteDayItems(dayId: string) {
  return db.delete(itineraryItems).where(eq(itineraryItems.dayId, dayId));
}

export async function deleteItem(id: string, userId: string) {
  // Ownership guard via JOIN
  const [item] = await db
    .select({ itemId: itineraryItems.id })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
    .innerJoin(trips, eq(itineraryDays.tripId, trips.id))
    .where(and(eq(itineraryItems.id, id), eq(trips.userId, userId)))
    .limit(1);
  if (!item) return null;

  await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
  return true;
}
