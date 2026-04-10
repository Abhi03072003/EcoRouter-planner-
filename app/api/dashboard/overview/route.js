export const dynamic = "force-dynamic";

import { ok, parseBodyError } from "@/lib/http";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Route from "@/models/Route";
import Report from "@/models/Report";
import TripStat from "@/models/TripStat";
import { fetchEnvironmentalSnapshot } from "@/services/weather";
import { estimatePopulationMetrics } from "@/services/population";

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat") || 28.6139);
    const lon = Number(searchParams.get("lon") || 77.209);

    const [snapshot, totals] = await Promise.all([
      fetchEnvironmentalSnapshot(lat, lon),
      (async () => {
        try {
          await connectToDatabase();

          const [usersCount, tripAgg, reportsCount, routes] = await Promise.all([
            User.countDocuments(),
            TripStat.aggregate([
              {
                $group: {
                  _id: null,
                  totalTrips: { $sum: 1 },
                  totalCo2Saved: { $sum: "$co2SavedGrams" }
                }
              }
            ]),
            Report.countDocuments({ status: "open" }),
            Route.find({}, { alternatives: 1, selectedRouteIndex: 1 }).limit(300).lean()
          ]);

          const allSelectedScores = routes
            .map((route) => route.alternatives?.[route.selectedRouteIndex]?.ecoScore)
            .filter((v) => typeof v === "number");

          const avgEcoScore = allSelectedScores.length
            ? Math.round(allSelectedScores.reduce((s, v) => s + v, 0) / allSelectedScores.length)
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

    return ok({
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
  } catch (error) {
    return parseBodyError(error);
  }
}
