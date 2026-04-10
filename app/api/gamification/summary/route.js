export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import mongoose from "mongoose";
import User from "@/models/User";
import TripStat from "@/models/TripStat";

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

  const summary = stats[0] || { trips: 0, totalCo2Saved: 0 };

  return ok({
    greenPoints: user?.greenPoints ?? 0,
    badges: user?.badges ?? [],
    trips: summary.trips,
    totalCo2Saved: summary.totalCo2Saved
  });
}
