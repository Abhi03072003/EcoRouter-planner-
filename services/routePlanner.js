import { calculateCo2Grams, calculateEcoScore, ecoCategory, normalize } from "../lib/eco.js";
import { fetchRouteAlternatives } from "./osrm.js";
import { fetchEnvironmentalFactors } from "./weather.js";
import { estimateTrafficIndex } from "./traffic.js";

function estimateDistanceKm(source, destination) {
  const dLat = source.lat - destination.lat;
  const dLon = source.lon - destination.lon;
  const roughKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;
  return Math.max(2, Number(roughKm.toFixed(1)));
}

function normalizeWeights(weights) {
  const defaults = { distance: 0.3, aqi: 0.25, traffic: 0.2, weather: 0.1, co2: 0.15 };
  if (!weights) {
    return defaults;
  }
  const total = Object.values(weights).reduce((sum, v) => sum + v, 0);
  if (!total) {
    return defaults;
  }
  return {
    distance: weights.distance / total,
    aqi: weights.aqi / total,
    traffic: weights.traffic / total,
    weather: weights.weather / total,
    co2: weights.co2 / total
  };
}

function buildAlternative({ route, label, mode, avgAqi, weatherRisk, trafficIndex, weights }) {
  const distanceKm = Number(route.distanceKm.toFixed(2));
  const durationMin = Number(route.durationMin.toFixed(1));
  const co2Grams = calculateCo2Grams(distanceKm, mode);

  const distanceNorm = normalize(distanceKm, 30);
  const aqiNorm = normalize(avgAqi, 300);
  const trafficNorm = normalize(trafficIndex, 100);
  const weatherNorm = normalize(weatherRisk, 100);
  const co2Norm = normalize(co2Grams, 4000);

  const ecoScore = calculateEcoScore({
    distanceNorm,
    aqiNorm,
    trafficNorm,
    weatherNorm,
    co2Norm,
    weights
  });

  const riskScore = Math.round(100 - (trafficNorm * 65 + weatherNorm * 35) * 100);

  return {
    providerRouteId: route.providerRouteId,
    label,
    distanceKm,
    durationMin,
    avgAqi,
    trafficIndex,
    weatherRisk,
    co2Grams,
    ecoScore,
    riskScore: Math.max(0, Math.min(100, riskScore)),
    polyline: route.polyline || "",
    category: ecoCategory(ecoScore),
    explain: {
      distancePct: Math.round(distanceNorm * 100),
      aqiPct: Math.round(aqiNorm * 100),
      trafficPct: Math.round(trafficNorm * 100),
      weatherPct: Math.round(weatherNorm * 100),
      co2Pct: Math.round(co2Norm * 100)
    }
  };
}

function pickLabels(routes) {
  if (!routes.length) {
    return [];
  }

  const byDuration = [...routes].sort((a, b) => a.durationMin - b.durationMin);
  const byDistance = [...routes].sort((a, b) => a.distanceKm - b.distanceKm);

  const fastestId = byDuration[0].providerRouteId;
  const shortestId = byDistance[0].providerRouteId;

  return routes.map((route) => {
    if (route.providerRouteId === fastestId) {
      return { ...route, label: "fastest" };
    }
    if (route.providerRouteId === shortestId) {
      return { ...route, label: "shortest" };
    }
    return { ...route, label: "greenest" };
  });
}

function fallbackRoutes(source, destination) {
  const baseDistance = estimateDistanceKm(source, destination);
  return [
    {
      providerRouteId: "fallback-1",
      distanceKm: baseDistance * 1.08,
      durationMin: baseDistance * 2.7,
      polyline: ""
    },
    {
      providerRouteId: "fallback-2",
      distanceKm: baseDistance * 0.92,
      durationMin: baseDistance * 3.1,
      polyline: ""
    },
    {
      providerRouteId: "fallback-3",
      distanceKm: baseDistance,
      durationMin: baseDistance * 3,
      polyline: ""
    }
  ];
}

export async function planRoutes({ source, destination, mode, weights }) {
  const normalizedWeights = normalizeWeights(weights);
  const [providerRoutes, env] = await Promise.all([
    fetchRouteAlternatives(source, destination).catch(() => []),
    fetchEnvironmentalFactors(destination.lat, destination.lon).catch(() => ({
      avgAqi: 90,
      weatherRisk: 25,
      weather: { condition: "clear", tempC: 28 }
    }))
  ]);

  const routes = providerRoutes.length ? providerRoutes : fallbackRoutes(source, destination);
  const labeled = pickLabels(routes).slice(0, 3);

  const alternatives = labeled.map((route) => {
    const trafficIndex = estimateTrafficIndex(route.durationMin, route.distanceKm);
    return buildAlternative({
      route,
      label: route.label,
      mode,
      avgAqi: env.avgAqi,
      weatherRisk: env.weatherRisk,
      trafficIndex,
      weights: normalizedWeights
    });
  });

  // Ensure a dedicated greenest option based on eco score.
  const topEco = alternatives.reduce((best, item) => (item.ecoScore > best.ecoScore ? item : best));
  const normalizedAlternatives = alternatives.map((item) =>
    item.providerRouteId === topEco.providerRouteId ? { ...item, label: "greenest" } : item
  );

  const fastest = [...normalizedAlternatives].sort((a, b) => a.durationMin - b.durationMin)[0];
  const baselineFastest = fastest.co2Grams;

  return {
    alternatives: normalizedAlternatives,
    baselineFastestCo2Grams: baselineFastest,
    recommendation: normalizedAlternatives.reduce((best, current) =>
      current.ecoScore > best.ecoScore ? current : best
    ),
    liveContext: {
      weather: env.weather,
      weights: normalizedWeights,
      dataSource: providerRoutes.length ? "osrm+openweather" : "fallback"
    }
  };
}
