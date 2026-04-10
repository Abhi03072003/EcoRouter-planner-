import express from "express";
import { connectToDatabase } from "../../lib/mongodb.js";
import { planRouteSchema, saveRouteSchema } from "../../lib/validators.js";
import Route from "../../models/Route.js";
import { planRoutes } from "../../services/routePlanner.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { requireAuth } from "../lib/auth.js";

const router = express.Router();

router.post("/plan", asyncHandler(async (req, res) => {
  const body = planRouteSchema.parse(req.body);
  const result = await planRoutes(body);

  return ok(res, {
    source: body.source,
    destination: body.destination,
    mode: body.mode,
    alternatives: result.alternatives,
    baselineFastestCo2Grams: result.baselineFastestCo2Grams,
    recommendation: result.recommendation,
    liveContext: result.liveContext
  });
}));

router.post("/save", requireAuth, asyncHandler(async (req, res) => {
  const body = saveRouteSchema.parse(req.body);
  await connectToDatabase();

  const route = await Route.create({
    userId: req.auth.userId,
    source: body.source,
    destination: body.destination,
    mode: body.mode,
    alternatives: body.alternatives,
    selectedRouteIndex: body.selectedRouteIndex,
    saved: true
  });

  return ok(res, { routeId: route._id }, 201);
}));

router.get("/history", requireAuth, asyncHandler(async (_req, res) => {
  await connectToDatabase();
  const routes = await Route.find({ userId: _req.auth.userId }).sort({ createdAt: -1 }).limit(50).lean();
  return ok(res, { routes });
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  await connectToDatabase();
  const route = await Route.findOne({ _id: req.params.id, userId: req.auth.userId }).lean();
  if (!route) return fail(res, "Route not found", 404);
  return ok(res, { route });
}));

export default router;
