import express from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "../../lib/mongodb.js";
import User from "../../models/User.js";
import Route from "../../models/Route.js";
import Report from "../../models/Report.js";
import TripStat from "../../models/TripStat.js";
import { fetchEnvironmentalSnapshot } from "../../services/weather.js";
import { estimatePopulationMetrics } from "../../services/population.js";
import { computeProfileRating } from "../../services/profile.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { getUserFromRequest } from "../lib/auth.js";

const router = express.Router();

function computePlatformRating({ avgEcoScore, totalCo2Saved, activeUsers }) {
  const ecoComponent = Math.min(50, Math.round((avgEcoScore || 0) / 2));
  const co2Component = Math.min(30, Math.round((totalCo2Saved || 0) / 1500));
  const usersComponent = Math.min(20, Math.round((activeUsers || 0) / 5));
  const score = Math.max(0, Math.min(100, ecoComponent + co2Component + usersComponent));

  let grade = "Improving";
  if (score >= 80) grade = "Excellent";
  else if (score >= 60) grade = "Good";
  else if (score >= 40) grade = "Fair";

  return { score, grade };
}

function boolEnv(name) {
  return Boolean(process.env[name]);
}

router.get("/dashboard/overview", asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat || 28.6139);
  const lon = Number(req.query.lon || 77.209);

  const [snapshot, totals] = await Promise.all([
    fetchEnvironmentalSnapshot(lat, lon),
    (async () => {
      try {
        await connectToDatabase();
        const [usersCount, tripAgg, reportsCount, routes] = await Promise.all([
          User.countDocuments(),
          TripStat.aggregate([{ $group: { _id: null, totalTrips: { $sum: 1 }, totalCo2Saved: { $sum: "$co2SavedGrams" } } }]),
          Report.countDocuments({ status: "open" }),
          Route.find({}, { alternatives: 1, selectedRouteIndex: 1 }).limit(300).lean()
        ]);

        const allSelectedScores = routes
          .map((route) => route.alternatives?.[route.selectedRouteIndex]?.ecoScore)
          .filter((value) => typeof value === "number");

        const avgEcoScore = allSelectedScores.length
          ? Math.round(allSelectedScores.reduce((sum, value) => sum + value, 0) / allSelectedScores.length)
          : 0;

        return {
          usersCount,
          reportsCount,
          totalTrips: tripAgg[0]?.totalTrips || 0,
          totalCo2Saved: tripAgg[0]?.totalCo2Saved || 0,
          avgEcoScore,
          degraded: false
        };
      } catch {
        return {
          usersCount: 0,
          reportsCount: 0,
          totalTrips: 0,
          totalCo2Saved: 0,
          avgEcoScore: 0,
          degraded: true
        };
      }
    })()
  ]);

  const platformRating = computePlatformRating({
    avgEcoScore: totals.avgEcoScore,
    totalCo2Saved: totals.totalCo2Saved,
    activeUsers: totals.usersCount
  });

  const next3h = snapshot.forecast[snapshot.forecast.length - 1] || snapshot.current;
  const population = estimatePopulationMetrics({
    cityTraffic: snapshot.current.trafficIndex,
    aqi: snapshot.current.aqi
  });

  return ok(res, {
    location: { lat, lon },
    current: snapshot.current,
    population,
    forecast: snapshot.forecast,
    next3hProjection: {
      projectedAqi: next3h.aqi,
      projectedCarbonRateGPerKm: next3h.carbonRateGPerKm,
      projectedTrafficIndex: next3h.trafficIndex,
      projectedCarbonPercent: Math.min(100, population.carbonPercent + 4)
    },
    platform: {
      rating: platformRating,
      averageEcoScore: totals.avgEcoScore,
      totalCo2SavedGrams: totals.totalCo2Saved,
      totalTrips: totals.totalTrips,
      activeUsers: totals.usersCount,
      openCommunityReports: totals.reportsCount,
      degraded: totals.degraded
    },
    source: snapshot.source
  });
}));

router.get("/system/health", asyncHandler(async (_req, res) => {
  const checks = {
    mongo: false,
    openWeather: boolEnv("OPENWEATHER_API_KEY"),
    osrmBase: boolEnv("OSRM_BASE_URL"),
    googleOAuth:
      boolEnv("GOOGLE_CLIENT_ID") &&
      (boolEnv("VITE_GOOGLE_CLIENT_ID") || boolEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")),
    emailNotify: boolEnv("RESEND_API_KEY") && boolEnv("FROM_EMAIL") && boolEnv("ADMIN_EMAIL"),
    aiChatbot: boolEnv("OPENAI_API_KEY")
  };

  try {
    await connectToDatabase();
    checks.mongo = true;
  } catch {
    checks.mongo = false;
  }

  const readinessScore = Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100);
  return ok(res, {
    status: readinessScore >= 70 ? "ready" : "partial",
    readinessScore,
    checks,
    timestamp: new Date().toISOString()
  });
}));

router.get("/admin/analytics", asyncHandler(async (_req, res) => {
  await connectToDatabase();

  const [reportBreakdown, savings] = await Promise.all([
    Report.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 }, avgSeverity: { $avg: "$severity" } } },
      { $sort: { count: -1 } }
    ]),
    TripStat.aggregate([
      { $group: { _id: null, totalTrips: { $sum: 1 }, totalCo2Saved: { $sum: "$co2SavedGrams" }, avgCo2Saved: { $avg: "$co2SavedGrams" } } }
    ])
  ]);

  return ok(res, {
    reportBreakdown,
    tripAnalytics: savings[0] || { totalTrips: 0, totalCo2Saved: 0, avgCo2Saved: 0 }
  });
}));

router.get("/gamification/summary", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Unauthorized", 401);

  await connectToDatabase();
  const [user, stats] = await Promise.all([
    User.findById(auth.userId).lean(),
    TripStat.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(auth.userId) } },
      { $group: { _id: null, trips: { $sum: 1 }, totalCo2Saved: { $sum: "$co2SavedGrams" } } }
    ])
  ]);

  const summary = stats[0] || { trips: 0, totalCo2Saved: 0 };
  const rating = computeProfileRating({ greenPoints: user?.greenPoints, totalCo2Saved: summary.totalCo2Saved, trips: summary.trips });

  return ok(res, {
    greenPoints: user?.greenPoints ?? 0,
    badges: user?.badges ?? [],
    trips: summary.trips,
    totalCo2Saved: summary.totalCo2Saved,
    profileRating: rating
  });
}));

export default router;
