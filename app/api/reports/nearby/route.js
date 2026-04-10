export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail } from "@/lib/http";
import Report from "@/models/Report";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return fail("lat and lon query params are required", 422);
  }

  await connectToDatabase();

  const reports = await Report.find({
    "location.lat": { $gte: lat - 0.15, $lte: lat + 0.15 },
    "location.lon": { $gte: lon - 0.15, $lte: lon + 0.15 }
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return ok({ reports });
}
