// GET /api/admin/diagnostics/enrichment
// Admin-only endpoint — tests each enrichment provider with a known place
// (Eiffel Tower, Paris) and returns full diagnostics.
//
// Also provides:
//  POST { action: "purge-null-cache" }  — deletes cache rows with no imageUrl
//  POST { action: "purge-null-cards" }  — deletes place cards with no imageUrl
//    (also nulls itineraryItems.placeCardId so generate-cards can re-run them)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { searchGeoapify } from "@/lib/places/geoapify";
import { searchWikimedia } from "@/lib/places/wikimedia";
import { searchPexels } from "@/lib/places/pexels";

export const dynamic = "force-dynamic";

// ─── Key info helper ─────────────────────────────────────────────────────────

function keyInfo(raw: string | undefined): {
  present: boolean;
  length: number;
  preview: string;
} {
  const trimmed = raw?.trim();
  if (!trimmed) return { present: false, length: 0, preview: "NOT SET" };
  return {
    present: true,
    length: trimmed.length,
    preview: `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`,
  };
}

// ─── GET — run provider tests ────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Test with a famous well-known landmark
  const TEST_NAME = "Eiffel Tower";
  const TEST_DEST = "Paris";
  const TEST_LAT = 48.8584;
  const TEST_LON = 2.2945;
  const TEST_CAT = "landmark";

  const [geoapify, wikimedia, pexels, cacheStats] = await Promise.allSettled([
    searchGeoapify(TEST_NAME, TEST_LAT, TEST_LON, TEST_CAT),
    searchWikimedia(TEST_NAME, TEST_DEST, TEST_CAT),
    searchPexels(TEST_NAME, TEST_DEST, TEST_CAT),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE image_url IS NOT NULL) AS with_image,
        COUNT(*) FILTER (WHERE image_url IS NULL) AS without_image,
        COUNT(*) AS total
      FROM place_enrichment_cache
    `),
  ]);

  const cardStats = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE image_url IS NOT NULL) AS with_image,
      COUNT(*) FILTER (WHERE image_url IS NULL) AS without_image,
      COUNT(*) AS total
    FROM place_cards
  `).catch(() => null);

  return NextResponse.json({
    keys: {
      GEOAPIFY_API_KEY: keyInfo(process.env.GEOAPIFY_API_KEY),
      PEXELS_API_KEY: keyInfo(process.env.PEXELS_API_KEY),
      GOOGLE_PLACES_API_KEY: keyInfo(process.env.GOOGLE_PLACES_API_KEY),
      GOOGLE_PLACES_ENABLED: process.env.GOOGLE_PLACES_ENABLED ?? "NOT SET",
    },
    providers: {
      geoapify: geoapify.status === "fulfilled"
        ? { ok: geoapify.value !== null, result: geoapify.value }
        : { ok: false, error: String((geoapify as PromiseRejectedResult).reason) },
      wikimedia: wikimedia.status === "fulfilled"
        ? { ok: wikimedia.value !== null, imageUrl: wikimedia.value?.imageUrl ?? null }
        : { ok: false, error: String((wikimedia as PromiseRejectedResult).reason) },
      pexels: pexels.status === "fulfilled"
        ? { ok: pexels.value !== null, imageUrl: pexels.value?.imageUrl ?? null }
        : { ok: false, error: String((pexels as PromiseRejectedResult).reason) },
    },
    cache: {
      enrichment: cacheStats.status === "fulfilled"
        ? (cacheStats.value as { rows?: unknown[] }).rows?.[0] ?? null
        : null,
      placeCards: cardStats
        ? (cardStats as { rows?: unknown[] }).rows?.[0] ?? null
        : null,
    },
    hint: "To clear poisoned rows: POST this endpoint with { action: 'purge-null-cache' } or { action: 'purge-null-cards' }",
  });
}

// ─── POST — cache purge actions ──────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = (await req.json()) as { action?: string };

  if (body.action === "purge-null-cache") {
    const result = await db.execute(sql`
      DELETE FROM place_enrichment_cache WHERE image_url IS NULL
    `);
    return NextResponse.json({
      ok: true,
      action: "purge-null-cache",
      deleted: (result as { rowCount?: number }).rowCount ?? "unknown",
    });
  }

  if (body.action === "purge-null-cards") {
    // First null out the itineraryItems foreign key so generate-cards can re-run
    await db.execute(sql`
      UPDATE itinerary_items
      SET place_card_id = NULL
      WHERE place_card_id IN (
        SELECT id FROM place_cards WHERE image_url IS NULL
      )
    `);
    const result = await db.execute(sql`
      DELETE FROM place_cards WHERE image_url IS NULL
    `);
    return NextResponse.json({
      ok: true,
      action: "purge-null-cards",
      deleted: (result as { rowCount?: number }).rowCount ?? "unknown",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
