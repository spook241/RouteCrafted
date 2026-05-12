import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTripById } from "@/lib/db/trips";
import { getForecast, wmoLabel } from "@/lib/weather/open-meteo";

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { tripId } = await ctx.params;
  const trip = await getTripById(tripId, session.user.id);
  if (!trip) return new NextResponse("Not Found", { status: 404 });

  if (!trip.lat || !trip.long) {
    return NextResponse.json({ forecast: [] });
  }

  try {
    const days = await getForecast(trip.lat, trip.long, trip.startDate, trip.endDate);
    const forecast = days.map((d) => ({
      date: d.date,
      weatherCode: d.weatherCode,
      label: wmoLabel(d.weatherCode),
      maxTempC: Math.round(d.maxTempC),
      precipProbability: d.precipProbability ?? 0,
    }));
    return NextResponse.json({ forecast });
  } catch {
    return NextResponse.json({ forecast: [] });
  }
}
