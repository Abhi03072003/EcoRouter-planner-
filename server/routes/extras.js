import express from "express";
import { connectToDatabase } from "../../lib/mongodb.js";
import { completeTripSchema, reportSchema } from "../../lib/validators.js";
import Report from "../../models/Report.js";
import TripStat from "../../models/TripStat.js";
import User from "../../models/User.js";
import { fetchRouteAlternatives } from "../../services/osrm.js";
import { estimateTrafficIndex } from "../../services/traffic.js";
import { fetchEnvironmentalFactors } from "../../services/weather.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { getUserFromRequest } from "../lib/auth.js";

const router = express.Router();

router.post("/reports", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Unauthorized", 401);

  const body = reportSchema.parse(req.body);
  await connectToDatabase();
  const report = await Report.create({ userId: auth.userId, type: body.type, location: body.location, severity: body.severity });
  return ok(res, { reportId: report._id }, 201);
}));

router.get("/reports/nearby", asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return fail(res, "lat and lon query params are required", 422);

  await connectToDatabase();
  const reports = await Report.find({
    "location.lat": { $gte: lat - 0.15, $lte: lat + 0.15 },
    "location.lon": { $gte: lon - 0.15, $lte: lon + 0.15 }
  }).sort({ createdAt: -1 }).limit(100).lean();

  return ok(res, { reports });
}));

router.get("/traffic/live", asyncHandler(async (req, res) => {
  const sourceLat = Number(req.query.sourceLat);
  const sourceLon = Number(req.query.sourceLon);
  const destinationLat = Number(req.query.destinationLat);
  const destinationLon = Number(req.query.destinationLon);

  if ([sourceLat, sourceLon, destinationLat, destinationLon].some((value) => Number.isNaN(value))) {
    return fail(res, "sourceLat, sourceLon, destinationLat, destinationLon query params are required", 422);
  }

  const routes = await fetchRouteAlternatives({ lat: sourceLat, lon: sourceLon }, { lat: destinationLat, lon: destinationLon });
  if (!routes.length) {
    return ok(res, { congestionLevel: 50, incidents: [], dataSource: "fallback" });
  }

  const enriched = routes.map((route) => ({
    routeId: route.providerRouteId,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    trafficIndex: estimateTrafficIndex(route.durationMin, route.distanceKm)
  }));

  const congestionLevel = Math.round(enriched.reduce((sum, route) => sum + route.trafficIndex, 0) / enriched.length);
  return ok(res, {
    updatedAt: new Date().toISOString(),
    congestionLevel,
    routes: enriched,
    incidents: congestionLevel > 70 ? [{ type: "heavy_congestion", severity: "high" }] : [],
    dataSource: "osrm-derived"
  });
}));

router.get("/weather/impact", asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return fail(res, "lat and lon query params are required", 422);

  const env = await fetchEnvironmentalFactors(lat, lon);
  return ok(res, {
    lat,
    lon,
    avgAqi: env.avgAqi,
    weatherRisk: env.weatherRisk,
    weather: env.weather,
    recommendation: env.weatherRisk >= 50 ? "Prefer covered transport due to current weather risk." : "Walking and cycling are suitable right now."
  });
}));

router.get("/ev/chargers", asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radiusKm = Number(req.query.radius || 5);
  const batteryRangeKm = Number(req.query.batteryRangeKm || 120);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return fail(res, "lat and lon query params are required", 422);

  const chargers = [
    { id: "ev-1", name: "City Fast Charge Hub", lat: lat + 0.008, lon: lon - 0.005, connectorTypes: ["CCS", "Type2"], powerKw: 60, distanceKm: 1.3 },
    { id: "ev-2", name: "Green Mall Charging Bay", lat: lat - 0.006, lon: lon + 0.004, connectorTypes: ["Type2"], powerKw: 22, distanceKm: 2.1 }
  ].filter((charger) => charger.distanceKm <= radiusKm);

  return ok(res, {
    center: { lat, lon },
    radiusKm,
    batteryRangeKm,
    lowBatteryWarning: batteryRangeKm <= 30,
    recommendation: batteryRangeKm <= 30 ? "Charge immediately: battery range is critically low." : "Range is healthy for short intra-city trips.",
    chargers
  });
}));

router.post("/trips/complete", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Unauthorized", 401);

  const body = completeTripSchema.parse(req.body);
  const co2SavedGrams = Math.max(0, body.baselineCo2Grams - body.selectedCo2Grams);

  await connectToDatabase();
  await TripStat.create({
    userId: auth.userId,
    routeId: body.routeId,
    baselineCo2Grams: body.baselineCo2Grams,
    selectedCo2Grams: body.selectedCo2Grams,
    co2SavedGrams,
    timeSavedMin: body.timeSavedMin
  });

  const points = Math.floor(co2SavedGrams / 100);
  const user = await User.findByIdAndUpdate(auth.userId, { $inc: { greenPoints: points } }, { new: true }).lean();
  return ok(res, { co2SavedGrams, pointsEarned: points, greenPoints: user?.greenPoints ?? 0 });
}));

export default router;
