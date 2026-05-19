import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/verify-bearer";
import { getTripsByUser, syncTripStatuses } from "@/lib/db/trips";

export async function GET(req: Request) {
  const payload = await verifyBearer(req);
  if (!payload) return new NextResponse("Unauthorized", { status: 401 });

  await syncTripStatuses(payload.sub);
  const trips = await getTripsByUser(payload.sub);
  return NextResponse.json(trips);
}
