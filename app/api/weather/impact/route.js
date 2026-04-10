export const dynamic = "force-dynamic";

import { ok, fail, parseBodyError } from "@/lib/http";
import { fetchEnvironmentalFactors } from "@/services/weather";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return fail("lat and lon query params are required", 422);
    }

    const env = await fetchEnvironmentalFactors(lat, lon);

    return ok({
      lat,
      lon,
      avgAqi: env.avgAqi,
      weatherRisk: env.weatherRisk,
      weather: env.weather,
      recommendation:
        env.weatherRisk >= 50
          ? "Prefer covered transport due to current weather risk."
          : "Walking and cycling are suitable right now."
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
