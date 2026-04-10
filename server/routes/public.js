import express from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "../../lib/mongodb.js";
import User from "../../models/User.js";
import TripStat from "../../models/TripStat.js";
import Route from "../../models/Route.js";
import { computeProfileRating } from "../../services/profile.js";
import { asyncHandler, fail, ok } from "../lib/http.js";

const router = express.Router();

router.get("/public/users/:id", asyncHandler(async (req, res) => {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, "Invalid user id", 422);

  const userId = new mongoose.Types.ObjectId(req.params.id);
  const [user, stats, routes] = await Promise.all([
    User.findById(userId).lean(),
    TripStat.aggregate([
      { $match: { userId } },
      { $group: { _id: null, trips: { $sum: 1 }, totalCo2Saved: { $sum: "$co2SavedGrams" }, avgSavedPerTrip: { $avg: "$co2SavedGrams" } } }
    ]),
    Route.find({ userId }, { source: 1, destination: 1, selectedRouteIndex: 1, alternatives: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

  if (!user) return fail(res, "User not found", 404);

  const summary = stats[0] || { trips: 0, totalCo2Saved: 0, avgSavedPerTrip: 0 };
  const rating = computeProfileRating({ greenPoints: user.greenPoints, totalCo2Saved: summary.totalCo2Saved, trips: summary.trips });
  const recentRoutes = routes.map((route) => {
    const chosen = route.alternatives?.[route.selectedRouteIndex] || null;
    return {
      id: route._id,
      source: route.source?.name || "Unknown",
      destination: route.destination?.name || "Unknown",
      ecoScore: chosen?.ecoScore ?? null,
      distanceKm: chosen?.distanceKm ?? null,
      category: chosen?.category ?? null,
      createdAt: route.createdAt
    };
  });

  return ok(res, {
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
}));

export default router;
