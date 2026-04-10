import express from "express";
import { connectToDatabase } from "../../lib/mongodb.js";
import { reviewCreateSchema, reviewsQuerySchema } from "../../lib/validators.js";
import { notifyAdmin } from "../../lib/notify.js";
import User from "../../models/User.js";
import Review from "../../models/Review.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { getUserFromRequest } from "../lib/auth.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  try {
    await connectToDatabase();
    const query = reviewsQuerySchema.parse({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20)
    });
    const skip = (query.page - 1) * query.limit;

    const [reviews, agg, reviewers, totalItems] = await Promise.all([
      Review.find({}).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      Review.aggregate([{ $group: { _id: null, totalReviews: { $sum: 1 }, averageRating: { $avg: "$rating" } } }]),
      Review.distinct("userId"),
      Review.countDocuments()
    ]);

    return ok(res, {
      reviews,
      metrics: {
        totalReviews: agg[0]?.totalReviews || 0,
        averageRating: Number((agg[0]?.averageRating || 0).toFixed(2)),
        totalReviewers: reviewers.length
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.limit))
      }
    });
  } catch (error) {
    return ok(res, {
      reviews: [],
      metrics: { totalReviews: 0, averageRating: 0, totalReviewers: 0 },
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 1 },
      degraded: true,
      error: error.message || "Reviews temporarily unavailable"
    });
  }
}));

router.post("/", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Login required", 401);

  const body = reviewCreateSchema.parse(req.body);
  await connectToDatabase();
  const user = await User.findById(auth.userId).lean();
  if (!user) return fail(res, "User not found", 404);

  const review = await Review.create({
    userId: user._id,
    userName: user.name,
    userAvatar: user.avatarUrl || "",
    rating: body.rating,
    comment: body.comment.trim()
  });

  await notifyAdmin({
    subject: `New Review from ${user.name}`,
    text: `Rating: ${body.rating}\nComment: ${body.comment.trim()}\nUser: ${user.email}`,
    html: `<p><strong>Rating:</strong> ${body.rating}</p><p><strong>Comment:</strong> ${body.comment.trim()}</p><p><strong>User:</strong> ${user.email}</p>`
  });

  return ok(res, { review }, 201);
}));

export default router;
