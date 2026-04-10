import express from "express";
import { connectToDatabase } from "../../lib/mongodb.js";
import { profileUpdateSchema } from "../../lib/validators.js";
import User from "../../models/User.js";
import Route from "../../models/Route.js";
import TripStat from "../../models/TripStat.js";
import Report from "../../models/Report.js";
import Review from "../../models/Review.js";
import HelpRequest from "../../models/HelpRequest.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { clearAuthCookie, requireAuth } from "../lib/auth.js";

const router = express.Router();

router.patch("/", requireAuth, asyncHandler(async (req, res) => {
  const body = profileUpdateSchema.parse(req.body);
  const updates = {
    name: body.name,
    bio: body.bio,
    city: body.city,
    phone: body.phone,
    preferredMode: body.preferredMode
  };

  await connectToDatabase();
  const user = await User.findByIdAndUpdate(req.auth.userId, updates, { new: true }).lean();
  if (!user) return fail(res, "User not found", 404);

  return ok(res, {
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
}));

router.delete("/", requireAuth, asyncHandler(async (req, res) => {
  await connectToDatabase();

  await Promise.all([
    Route.deleteMany({ userId: req.auth.userId }),
    TripStat.deleteMany({ userId: req.auth.userId }),
    Report.deleteMany({ userId: req.auth.userId }),
    Review.deleteMany({ userId: req.auth.userId }),
    HelpRequest.deleteMany({ userId: req.auth.userId }),
    User.deleteOne({ _id: req.auth.userId })
  ]);

  clearAuthCookie(res);
  return ok(res, { success: true, message: "Account deleted" });
}));

export default router;
