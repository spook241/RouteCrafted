CREATE TABLE "place_enrichment_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_name_normalized" text NOT NULL,
	"destination" text NOT NULL,
	"category" text,
	"provider" text NOT NULL,
	"provider_id" text,
	"lat" numeric,
	"lon" numeric,
	"rating" numeric(3, 1),
	"review_count" integer,
	"price_level" integer,
	"image_url" text,
	"image_attribution" text,
	"image_source" text,
	"image_is_exact" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "rating" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "review_count" integer;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "price_level" integer;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "opening_hours" text[];--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "image_source" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "image_attribution" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "image_is_exact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "enrichment_confidence" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "external_source" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "external_place_id" text;--> statement-breakpoint
ALTER TABLE "place_cards" ADD COLUMN "enriched_at" timestamp;