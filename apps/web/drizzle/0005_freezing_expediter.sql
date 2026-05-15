ALTER TABLE "itinerary_items" ADD COLUMN "tips" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "booking_required" boolean DEFAULT false NOT NULL;