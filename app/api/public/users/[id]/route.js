export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { ok, fail, parseBodyError } from "@/lib/http";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import TripStat from "@/models/TripStat";
import Route from "@/models/Route";
import { computeProfileRating } from "@/services/profile";

export async function GET(_request, { params }) {
  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return fail("Invalid user id", 422);
    }

    const userId = new mongoose.Types.ObjectId(params.id);

    const [user, stats, routes] = await Promise.all([
      User.findById(userId).lean(),
      TripStat.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            trips: { $sum: 1 },
            totalCo2Saved: { $sum: "$co2SavedGrams" },
            avgSavedPerTrip: { $avg: "$co2SavedGrams" }
          }
        }
      ]),
      Route.find({ userId }, { source: 1, destination: 1, selectedRouteIndex: 1, alternatives: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    if (!user) {
      return fail("User not found", 404);
    }

    const summary = stats[0] || { trips: 0, totalCo2Saved: 0, avgSavedPerTrip: 0 };
    const rating = computeProfileRating({
      greenPoints: user.greenPoints,
      totalCo2Saved: summary.totalCo2Saved,
      trips: summary.trips
    });

    const recentRoutes = routes.map((r) => {
      const chosen = r.alternatives?.[r.selectedRouteIndex] || null;
      return {
        id: r._id,
        source: r.source?.name || "Unknown",
        destination: r.destination?.name || "Unknown",
        ecoScore: chosen?.ecoScore ?? null,
        distanceKm: chosen?.distanceKm ?? null,
        category: chosen?.category ?? null,
        createdAt: r.createdAt
      };
    });

    return ok({
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        city: user.city,
        phone: user.phone,
        preferredMode: user.preferredMode,
        badges: user.badges,
        greenPoints: user.greenPoints,
        joinedAt: user.createdAt,
        profileRating: rating
      },
      stats: {
        trips: summary.trips,
        totalCo2SavedGrams: Math.round(summary.totalCo2Saved || 0),
        avgSavedPerTripGrams: Math.round(summary.avgSavedPerTrip || 0)
      },
      recentRoutes
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
