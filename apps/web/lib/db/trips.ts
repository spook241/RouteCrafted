import { eq, and, desc, lt, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { trips } from "./schema";

export type TripInsert = {
  userId: string;
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
};

export type TripUpdate = Partial<
  Omit<TripInsert, "userId"> & {
    status: string;
    coverImageUrl: string | null;
    rating: number | null;
    comment: string | null;
  }
>;

export async function getTripsByUser(userId: string) {
  return db
    .select()
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.createdAt));
}

export async function getTripById(id: string, userId: string) {
  const result = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createTrip(data: TripInsert) {
  const result = await db.insert(trips).values(data).returning();
  return result[0];
}

export async function updateTrip(
  id: string,
  userId: string,
  data: TripUpdate,
) {
  const result = await db
    .update(trips)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning();
  return result[0] ?? null;
}

export async function deleteTrip(id: string, userId: string) {
  const result = await db
    .delete(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning({ id: trips.id });
  return result[0] ?? null;
}

export async function markExpiredTripsCompleted(userId: string) {
  await db
    .update(trips)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(trips.userId, userId),
        lt(trips.endDate, sql`CURRENT_DATE`),
        ne(trips.status, "completed"),
      ),
    );
}
