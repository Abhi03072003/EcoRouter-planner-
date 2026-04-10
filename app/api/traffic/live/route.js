export const dynamic = "force-dynamic";

import { ok, fail, parseBodyError } from "@/lib/http";
import { fetchRouteAlternatives } from "@/services/osrm";
import { estimateTrafficIndex } from "@/services/traffic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceLat = Number(searchParams.get("sourceLat"));
    const sourceLon = Number(searchParams.get("sourceLon"));
    const destinationLat = Number(searchParams.get("destinationLat"));
    const destinationLon = Number(searchParams.get("destinationLon"));

    if (
      [sourceLat, sourceLon, destinationLat, destinationLon].some((n) =>
        Number.isNaN(n)
      )
    ) {
      return fail(
        "sourceLat, sourceLon, destinationLat, destinationLon query params are required",
        422
      );
    }

    const routes = await fetchRouteAlternatives(
      { lat: sourceLat, lon: sourceLon },
      { lat: destinationLat, lon: destinationLon }
    );

    if (!routes.length) {
      return ok({
        congestionLevel: 50,
        incidents: [],
        dataSource: "fallback"
      });
    }

    const enriched = routes.map((route) => ({
      routeId: route.providerRouteId,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      trafficIndex: estimateTrafficIndex(route.durationMin, route.distanceKm)
    }));

    const congestionLevel = Math.round(
      enriched.reduce((sum, r) => sum + r.trafficIndex, 0) / enriched.length
    );

    return ok({
      updatedAt: new Date().toISOString(),
      congestionLevel,
      routes: enriched,
      incidents: congestionLevel > 70 ? [{ type: "heavy_congestion", severity: "high" }] : [],
      dataSource: "osrm-derived"
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
