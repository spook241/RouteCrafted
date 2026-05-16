import { desc, eq, sum, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiTelemetry, trips, users } from "@/lib/db/schema";

// ─── Insert ───────────────────────────────────────────────────────────────────

export async function insertTelemetry(
  row: typeof aiTelemetry.$inferInsert,
) {
  return db.insert(aiTelemetry).values(row).returning();
}

// ─── Global summary ───────────────────────────────────────────────────────────

export async function getTelemetrySummary() {
  const [totals] = await db
    .select({
      totalCalls: count(),
      totalTokens: sum(aiTelemetry.totalTokens),
      totalCostUsd: sum(aiTelemetry.estimatedCostUsd),
    })
    .from(aiTelemetry);

  const byType = await db
    .select({
      callType: aiTelemetry.callType,
      calls: count(),
      tokens: sum(aiTelemetry.totalTokens),
      costUsd: sum(aiTelemetry.estimatedCostUsd),
    })
    .from(aiTelemetry)
    .groupBy(aiTelemetry.callType);

  return { totals, byType };
}

// ─── Per-trip aggregates (for the trips list) ─────────────────────────────────

export async function getTelemetryByTrip() {
  return db
    .select({
      tripId: aiTelemetry.tripId,
      destination: trips.destination,
      country: trips.country,
      startDate: trips.startDate,
      endDate: trips.endDate,
      calls: count(),
      totalTokens: sum(aiTelemetry.totalTokens),
      totalCostUsd: sum(aiTelemetry.estimatedCostUsd),
      lastCallAt: sql<Date>`max(${aiTelemetry.createdAt})`,
    })
    .from(aiTelemetry)
    .leftJoin(trips, eq(aiTelemetry.tripId, trips.id))
    .where(sql`${aiTelemetry.tripId} is not null`)
    .groupBy(
      aiTelemetry.tripId,
      trips.destination,
      trips.country,
      trips.startDate,
      trips.endDate,
    )
    .orderBy(desc(sql`max(${aiTelemetry.createdAt})`));
}

// ─── Per-trip detail (drill-down) ─────────────────────────────────────────────

export async function getTripTelemetry(tripId: string) {
  return db
    .select({
      id: aiTelemetry.id,
      callType: aiTelemetry.callType,
      model: aiTelemetry.model,
      dayId: aiTelemetry.dayId,
      itemId: aiTelemetry.itemId,
      userId: aiTelemetry.userId,
      userEmail: users.email,
      promptTokens: aiTelemetry.promptTokens,
      completionTokens: aiTelemetry.completionTokens,
      totalTokens: aiTelemetry.totalTokens,
      estimatedCostUsd: aiTelemetry.estimatedCostUsd,
      latencyMs: aiTelemetry.latencyMs,
      success: aiTelemetry.success,
      errorMessage: aiTelemetry.errorMessage,
      createdAt: aiTelemetry.createdAt,
    })
    .from(aiTelemetry)
    .leftJoin(users, eq(aiTelemetry.userId, users.id))
    .where(eq(aiTelemetry.tripId, tripId))
    .orderBy(desc(aiTelemetry.createdAt));
}
