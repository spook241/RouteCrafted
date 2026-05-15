import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  date,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("traveler"), // 'traveler' | 'admin'
  avatarUrl: text("avatar_url"),
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── trips ────────────────────────────────────────────────────────────────────

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  country: text("country").notNull(),
  lat: numeric("lat"),
  long: numeric("long"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  budgetRange: text("budget_range").notNull(), // 'budget' | 'mid' | 'luxury'
  travelStyle: text("travel_style").notNull(), // 'cultural' | 'adventure' | 'relaxation' | 'foodie'
  groupType: text("group_type").notNull(), // 'solo' | 'couple' | 'family' | 'friends'
  pacing: text("pacing").notNull(), // 'relaxed' | 'moderate' | 'packed'
  status: text("status").notNull().default("draft"), // 'draft' | 'active' | 'completed'
  coverImageUrl: text("cover_image_url"),
  rating: integer("rating"), // 1–5, user rating after trip
  comment: text("comment"), // short post-trip comment
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── itinerary_days ───────────────────────────────────────────────────────────

export const itineraryDays = pgTable("itinerary_days", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  date: date("date").notNull(),
  theme: text("theme").notNull(),
  summary: text("summary").notNull(),
  weatherCode: integer("weather_code"),
  weatherLabel: text("weather_label"),
  weatherAlerted: boolean("weather_alerted").notNull().default(false),
  rewrittenAt: timestamp("rewritten_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── itinerary_items ──────────────────────────────────────────────────────────

export const itineraryItems = pgTable("itinerary_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dayId: uuid("day_id")
    .notNull()
    .references(() => itineraryDays.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  timeBlock: text("time_block").notNull(), // 'morning' | 'afternoon' | 'evening'
  type: text("type").notNull(), // 'activity' | 'meal' | 'transport'
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  durationMins: integer("duration_mins").notNull(),
  estimatedCost: numeric("estimated_cost").notNull(),
  isOptional: boolean("is_optional").notNull().default(false),
  placeCardId: uuid("place_card_id"), // FK added in Phase 6
  category: text("category"), // e.g. 'museum' | 'restaurant' | 'landmark' etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── place_cards ──────────────────────────────────────────────────────────────

export const placeCards = pgTable("place_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  verdict: text("verdict").notNull(), // 'worth_it' | 'skip_it' | 'depends'
  summary: text("summary").notNull(),
  worthItReasons: text("worth_it_reasons").array().notNull().default(sql`'{}'`),
  skipItReasons: text("skip_it_reasons").array().notNull().default(sql`'{}'`),
  bestFor: text("best_for").notNull(),
  costLevel: text("cost_level").notNull(), // 'free' | 'low' | 'medium' | 'high'
  timeNeeded: text("time_needed").notNull(),
  lat: numeric("lat"),
  long: numeric("long"),
  imageUrl: text("image_url"),
  // ── enrichment metadata (added Phase 1) ──────────────────────────────────
  rating: numeric("rating", { precision: 3, scale: 1 }),
  reviewCount: integer("review_count"),
  priceLevel: integer("price_level"), // 1–4
  openingHours: text("opening_hours").array(),
  imageSource: text("image_source"), // 'google' | 'wikimedia' | 'pexels' | 'unsplash' | 'opentripmap'
  imageAttribution: text("image_attribution"),
  imageIsExact: boolean("image_is_exact").notNull().default(false),
  enrichmentConfidence: text("enrichment_confidence"), // 'high' | 'medium' | 'low'
  externalSource: text("external_source"),
  externalPlaceId: text("external_place_id"),
  enrichedAt: timestamp("enriched_at"),
  // ─────────────────────────────────────────────────────────────────────────
  flagged: boolean("flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── place_enrichment_cache ───────────────────────────────────────────────────

export const placeEnrichmentCache = pgTable("place_enrichment_cache", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  placeNameNormalized: text("place_name_normalized").notNull(),
  destination: text("destination").notNull(),
  category: text("category"),
  provider: text("provider").notNull(), // 'wikimedia' | 'pexels' | 'geoapify' | 'google'
  providerId: text("provider_id"),
  lat: numeric("lat"),
  lon: numeric("lon"),
  rating: numeric("rating", { precision: 3, scale: 1 }),
  reviewCount: integer("review_count"),
  priceLevel: integer("price_level"),
  imageUrl: text("image_url"),
  imageAttribution: text("image_attribution"),
  imageSource: text("image_source"),
  imageIsExact: boolean("image_is_exact").notNull().default(false),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ─── weather_alerts ───────────────────────────────────────────────────────────

export const weatherAlerts = pgTable("weather_alerts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  dayId: uuid("day_id")
    .notNull()
    .references(() => itineraryDays.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(), // 'rain' | 'storm' | 'extreme_heat' | 'snow'
  forecastCode: integer("forecast_code").notNull(),
  alertedAt: timestamp("alerted_at").notNull().defaultNow(),
  dismissed: boolean("dismissed").notNull().default(false),
  rewriteAccepted: boolean("rewrite_accepted").notNull().default(false),
});

// ─── ai_prompts ───────────────────────────────────────────────────────────────

export const aiPrompts = pgTable("ai_prompts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  promptKey: text("prompt_key").notNull(), // 'generate_itinerary' | 'rewrite_day' | 'place_card'
  version: integer("version").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  template: text("template").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── ai_settings ──────────────────────────────────────────────────────────────

export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── admin_flags ──────────────────────────────────────────────────────────────

export const adminFlags = pgTable("admin_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  placeCardId: uuid("place_card_id")
    .notNull()
    .references(() => placeCards.id, { onDelete: "cascade" }),
  raisedBy: uuid("raised_by")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'dismissed'
  resolvedBy: uuid("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
