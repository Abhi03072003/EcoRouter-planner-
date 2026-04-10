export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import mongoose from "mongoose";
import User from "@/models/User";
import TripStat from "@/models/TripStat";
import { computeProfileRating } from "@/services/profile";

export async function GET() {
  const auth = getUserFromRequest();
  if (!auth?.userId) {
    return fail("Unauthorized", 401);
  }

  await connectToDatabase();
  const [user, stats] = await Promise.all([
    User.findById(auth.userId).lean(),
    TripStat.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(auth.userId) } },
      {
        $group: {
          _id: null,
          trips: { $sum: 1 },
          totalCo2Saved: { $sum: "$co2SavedGrams" }
        }
      }
    ])
  ]);

  if (!user) {
    return fail("User not found", 404);
  }
  const tripSummary = stats[0] || { trips: 0, totalCo2Saved: 0 };
  const rating = computeProfileRating({
    greenPoints: user.greenPoints,
    totalCo2Saved: tripSummary.totalCo2Saved,
    trips: tripSummary.trips
  });

  return ok({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      city: user.city,
      phone: user.phone,
      preferredMode: user.preferredMode,
      greenPoints: user.greenPoints,
      badges: user.badges,
      trips: tripSummary.trips,
      totalCo2Saved: tripSummary.totalCo2Saved,
      profileRating: rating,
      publicProfileUrl: `/u/${user._id}`
    }
  });
}
