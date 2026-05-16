import { z } from "zod";

export const itineraryItemSchema = z.object({
  timeBlock: z.enum(["morning", "afternoon", "evening"]),
  type: z.enum(["activity", "meal", "transport"]),
  category: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  durationMins: z.number().int().positive(),
  estimatedCost: z.number().nonnegative(),
  isOptional: z.boolean().default(false),
  tips: z.string().nullable().optional(),
  bookingRequired: z.boolean().optional().default(false),
});

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string().min(1),
  summary: z.string().min(1),
  items: z.array(itineraryItemSchema).min(1),
});

export const itineraryResponseSchema = z.array(itineraryDaySchema).min(1);

export const rewriteDayResponseSchema = itineraryDaySchema;

export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;

// ─── Place Card ───────────────────────────────────────────────────────────────

export const placeCardResponseSchema = z.object({
  verdict: z.enum(["worth_it", "skip_it", "depends"]),
  summary: z.string().min(1),
  worthItReasons: z.array(z.string()),
  skipItReasons: z.array(z.string()),
  bestFor: z.string().min(1),
  costLevel: z.enum(["free", "low", "medium", "high"]),
  timeNeeded: z.string().min(1),
});

export type PlaceCardResponse = z.infer<typeof placeCardResponseSchema>;
