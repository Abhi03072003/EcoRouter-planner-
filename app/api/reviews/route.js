export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { notifyAdmin } from "@/lib/notify";
import { reviewCreateSchema, reviewsQuerySchema } from "@/lib/validators";
import User from "@/models/User";
import Review from "@/models/Review";

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const query = reviewsQuerySchema.parse({
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 20)
    });
    const skip = (query.page - 1) * query.limit;

    const [reviews, agg, reviewers, totalItems] = await Promise.all([
      Review.find({}).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$rating" }
          }
        }
      ]),
      Review.distinct("userId"),
      Review.countDocuments()
    ]);

    return ok({
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
    return ok({
      reviews: [],
      metrics: {
        totalReviews: 0,
        averageRating: 0,
        totalReviewers: 0
      },
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 1
      },
      degraded: true,
      error: error.message || "Reviews temporarily unavailable"
    });
  }
}

export async function POST(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) return fail("Login required", 401);

    const body = reviewCreateSchema.parse(await request.json());
    const rating = body.rating;
    const comment = body.comment.trim();

    await connectToDatabase();
    const user = await User.findById(auth.userId).lean();
    if (!user) return fail("User not found", 404);

    const review = await Review.create({
      userId: user._id,
      userName: user.name,
      userAvatar: user.avatarUrl || "",
      rating,
      comment
    });

    await notifyAdmin({
      subject: `New Review from ${user.name}`,
      text: `Rating: ${rating}\nComment: ${comment}\nUser: ${user.email}`,
      html: `<p><strong>Rating:</strong> ${rating}</p><p><strong>Comment:</strong> ${comment}</p><p><strong>User:</strong> ${user.email}</p>`
    });

    return ok({ review }, 201);
  } catch (error) {
    return parseBodyError(error);
  }
}
