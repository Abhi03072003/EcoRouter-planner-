export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest, clearAuthCookie } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validators";
import User from "@/models/User";
import Route from "@/models/Route";
import TripStat from "@/models/TripStat";
import Report from "@/models/Report";
import Review from "@/models/Review";
import HelpRequest from "@/models/HelpRequest";

export async function PATCH(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) return fail("Unauthorized", 401);

    const body = profileUpdateSchema.parse(await request.json());
    const updates = {
      name: body.name,
      bio: body.bio,
      city: body.city,
      phone: body.phone,
      preferredMode: body.preferredMode
    };

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(auth.userId, updates, { new: true }).lean();
    if (!user) return fail("User not found", 404);

    return ok({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        city: user.city,
        phone: user.phone,
        bio: user.bio,
        preferredMode: user.preferredMode,
        publicProfileUrl: `/u/${user._id}`
      }
    });
  } catch (error) {
    return parseBodyError(error);
  }
}

export async function DELETE() {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) return fail("Unauthorized", 401);

    await connectToDatabase();

    await Promise.all([
      Route.deleteMany({ userId: auth.userId }),
      TripStat.deleteMany({ userId: auth.userId }),
      Report.deleteMany({ userId: auth.userId }),
      Review.deleteMany({ userId: auth.userId }),
      HelpRequest.deleteMany({ userId: auth.userId }),
      User.deleteOne({ _id: auth.userId })
    ]);

    clearAuthCookie();
    return ok({ success: true, message: "Account deleted" });
  } catch (error) {
    return parseBodyError(error);
  }
}
