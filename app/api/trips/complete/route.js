export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { completeTripSchema } from "@/lib/validators";
import TripStat from "@/models/TripStat";
import User from "@/models/User";

export async function POST(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) {
      return fail("Unauthorized", 401);
    }

    const body = completeTripSchema.parse(await request.json());
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
    const user = await User.findByIdAndUpdate(
      auth.userId,
      { $inc: { greenPoints: points } },
      { new: true }
    ).lean();

    return ok({
      co2SavedGrams,
      pointsEarned: points,
      greenPoints: user?.greenPoints ?? 0
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
