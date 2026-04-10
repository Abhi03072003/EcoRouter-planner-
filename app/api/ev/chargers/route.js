export const dynamic = "force-dynamic";

import { ok, fail } from "@/lib/http";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radiusKm = Number(searchParams.get("radius") || 5);
  const batteryRangeKm = Number(searchParams.get("batteryRangeKm") || 120);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return fail("lat and lon query params are required", 422);
  }

  // Placeholder dataset; replace with OpenChargeMap/provider in production.
  const chargers = [
    {
      id: "ev-1",
      name: "City Fast Charge Hub",
      lat: lat + 0.008,
      lon: lon - 0.005,
      connectorTypes: ["CCS", "Type2"],
      powerKw: 60,
      distanceKm: 1.3
    },
    {
      id: "ev-2",
      name: "Green Mall Charging Bay",
      lat: lat - 0.006,
      lon: lon + 0.004,
      connectorTypes: ["Type2"],
      powerKw: 22,
      distanceKm: 2.1
    }
  ].filter((c) => c.distanceKm <= radiusKm);

  return ok({
    center: { lat, lon },
    radiusKm,
    batteryRangeKm,
    lowBatteryWarning: batteryRangeKm <= 30,
    recommendation:
      batteryRangeKm <= 30
        ? "Charge immediately: battery range is critically low."
        : "Range is healthy for short intra-city trips.",
    chargers
  });
}
