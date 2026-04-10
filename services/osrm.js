import { fetchJson } from "../lib/fetcher.js";

const DEFAULT_OSRM_BASE = "https://router.project-osrm.org";

export async function fetchRouteAlternatives(source, destination) {
  const osrmBase = process.env.OSRM_BASE_URL || DEFAULT_OSRM_BASE;
  const coordinates = `${source.lon},${source.lat};${destination.lon},${destination.lat}`;

  const url =
    `${osrmBase}/route/v1/driving/${coordinates}` +
    "?alternatives=true&steps=false&overview=full&geometries=polyline";

  const payload = await fetchJson(url, { timeoutMs: 9000, retries: 1 });
  if (!payload?.routes?.length) {
    return [];
  }

  return payload.routes.map((route, index) => ({
    providerRouteId: `osrm-${index + 1}`,
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationMin: Number((route.duration / 60).toFixed(1)),
    polyline: route.geometry || ""
  }));
}
