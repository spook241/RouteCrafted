import { eq, and, asc, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { placeCards, adminFlags, trips, itineraryItems, placeEnrichmentCache } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaceCardInsert = {
  tripId: string;
  name: string;
  category: string;
  verdict: string;
  summary: string;
  worthItReasons: string[];
  skipItReasons: string[];
  bestFor: string;
  costLevel: string;
  timeNeeded: string;
  lat?: string | null;
  long?: string | null;
  imageUrl?: string | null;
  // enrichment fields (Phase 1)
  rating?: string | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  openingHours?: string[] | null;
  imageSource?: string | null;
  imageAttribution?: string | null;
  imageIsExact?: boolean;
  enrichmentConfidence?: string | null;
  externalSource?: string | null;
  externalPlaceId?: string | null;
  enrichedAt?: Date | null;
};

export type EnrichmentCacheInsert = {
  placeNameNormalized: string;
  destination: string;
  category?: string | null;
  provider: string;
  providerId?: string | null;
  lat?: string | null;
  lon?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  imageUrl?: string | null;
  imageAttribution?: string | null;
  imageSource?: string | null;
  imageIsExact?: boolean;
  rawPayload?: unknown;
  expiresAt: Date;
};

// ─── Place Cards ──────────────────────────────────────────────────────────────

export async function getPlaceCardsByTrip(tripId: string) {
  return db
    .select()
    .from(placeCards)
    .where(and(eq(placeCards.tripId, tripId), eq(placeCards.flagged, false)))
    .orderBy(asc(placeCards.createdAt));
}

export async function getAllPlaceCardsByTrip(tripId: string) {
  return db
    .select()
    .from(placeCards)
    .where(eq(placeCards.tripId, tripId))
    .orderBy(asc(placeCards.createdAt));
}

export async function getPlaceCardById(id: string) {
  const rows = await db
    .select()
    .from(placeCards)
    .where(eq(placeCards.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertPlaceCard(data: PlaceCardInsert) {
  const rows = await db.insert(placeCards).values(data).returning();
  return rows[0];
}

export async function linkItemToCard(itemId: string, cardId: string) {
  await db
    .update(itineraryItems)
    .set({ placeCardId: cardId })
    .where(eq(itineraryItems.id, itemId));
}

export async function flagPlaceCard(
  cardId: string,
  userId: string,
  reason: string,
): Promise<boolean> {
  // Verify card exists
  const card = await getPlaceCardById(cardId);
  if (!card) return false;

  // Create flag record
  await db.insert(adminFlags).values({
    placeCardId: cardId,
    raisedBy: userId,
    reason,
    status: "open",
  });

  // Mark card as flagged
  await db
    .update(placeCards)
    .set({ flagged: true, flagReason: reason, updatedAt: new Date() })
    .where(eq(placeCards.id, cardId));

  return true;
}

// ─── Admin Flags ──────────────────────────────────────────────────────────────

export async function getOpenFlags() {
  return db
    .select({
      flag: adminFlags,
      card: placeCards,
    })
    .from(adminFlags)
    .innerJoin(placeCards, eq(adminFlags.placeCardId, placeCards.id))
    .where(eq(adminFlags.status, "open"))
    .orderBy(asc(adminFlags.createdAt));
}

export async function resolveFlag(
  flagId: string,
  resolvedBy: string,
  action: "resolved" | "dismissed",
) {
  const rows = await db
    .update(adminFlags)
    .set({ status: action, resolvedBy, updatedAt: new Date() })
    .where(eq(adminFlags.id, flagId))
    .returning();
  const flag = rows[0] ?? null;

  // When dismissed, restore the card's visibility
  if (flag && action === "dismissed") {
    await db
      .update(placeCards)
      .set({ flagged: false, flagReason: null, updatedAt: new Date() })
      .where(eq(placeCards.id, flag.placeCardId));
  }

  return flag;
}

export async function deletePlaceCard(id: string) {
  // Null out item references first (no FK constraint in DB)
  await db
    .update(itineraryItems)
    .set({ placeCardId: null })
    .where(eq(itineraryItems.placeCardId, id));

  const rows = await db
    .delete(placeCards)
    .where(eq(placeCards.id, id))
    .returning();
  return rows[0] ?? null;
}

// ─── Enrichment Cache ─────────────────────────────────────────────────────────

export async function getCachedEnrichment(
  placeNameNormalized: string,
  destination: string,
  category: string | null | undefined,
) {
  const now = new Date();
  const rows = await db
    .select()
    .from(placeEnrichmentCache)
    .where(
      and(
        eq(placeEnrichmentCache.placeNameNormalized, placeNameNormalized),
        eq(placeEnrichmentCache.destination, destination),
        gt(placeEnrichmentCache.expiresAt, now),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertEnrichmentCache(data: EnrichmentCacheInsert) {
  const rows = await db
    .insert(placeEnrichmentCache)
    .values(data)
    .returning();
  return rows[0];
}

