CREATE TABLE "ai_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_type" text,
	"model" text,
	"trip_id" uuid,
	"day_id" uuid,
	"item_id" uuid,
	"user_id" uuid,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_usd" numeric(10, 6),
	"latency_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_telemetry" ADD CONSTRAINT "ai_telemetry_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_telemetry" ADD CONSTRAINT "ai_telemetry_day_id_itinerary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_telemetry" ADD CONSTRAINT "ai_telemetry_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_telemetry" ADD CONSTRAINT "ai_telemetry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;