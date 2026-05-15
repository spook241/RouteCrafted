import { NextResponse } from "next/server";
import { getForecast, wmoEmoji } from "@/lib/weather/open-meteo";
import { format, addDays } from "date-fns";

// GET /api/weather/preview?lat=48.85&lon=2.35&days=16
// Public — lat/lon is not user-owned data.
// Returns compact forecast for the date-range picker calendar overlay.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");
  const daysStr = searchParams.get("days") ?? "16";

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const days = Math.min(Math.max(parseInt(daysStr, 10) || 16, 1), 16);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const today = new Date();
    const startDate = format(today, "yyyy-MM-dd");
    const endDate = format(addDays(today, days - 1), "yyyy-MM-dd");

    const raw = await getForecast(lat, lon, startDate, endDate);

    const forecast = raw.map((d) => ({
      date: d.date,
      emoji: wmoEmoji(d.weatherCode),
      maxTempC: Math.round(d.maxTempC),
    }));

    return NextResponse.json({ forecast }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ forecast: [] });
  }
}
