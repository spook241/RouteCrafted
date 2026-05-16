import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/verify-bearer";
import { getTripById } from "@/lib/db/trips";
import { getDaysWithItemsByTrip } from "@/lib/db/itinerary";

type Props = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Props) {
  const payload = await verifyBearer(req);
  if (!payload) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const trip = await getTripById(id, payload.sub);
  if (!trip) return new NextResponse("Not Found", { status: 404 });

  const days = await getDaysWithItemsByTrip(id);
  return NextResponse.json({ ...trip, days });
}
