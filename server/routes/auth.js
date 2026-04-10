import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../../lib/mongodb.js";
import { verifyGoogleIdToken } from "../../lib/google.js";
import { signupSchema, loginSchema, otpRequestSchema, otpVerifySchema } from "../../lib/validators.js";
import User from "../../models/User.js";
import OtpCode from "../../models/OtpCode.js";
import TripStat from "../../models/TripStat.js";
import { computeProfileRating } from "../../services/profile.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { clearAuthCookie, getUserFromRequest, setAuthCookie, signAuthToken } from "../lib/auth.js";

const router = express.Router();

function normalizePhone(raw) {
  return String(raw || "").replace(/[^0-9+]/g, "").slice(0, 16);
}

function syntheticEmail(phone) {
  const clean = phone.replace(/[^0-9]/g, "");
  return `phone_${clean}@otp.local`;
}

router.post("/login", asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  await connectToDatabase();

  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user) return fail(res, "Invalid credentials", 401);
  if (user.authProvider !== "local") return fail(res, "This account uses Google sign-in.", 403);

  const validPassword = await bcrypt.compare(body.password, user.passwordHash || "");
  if (!validPassword) return fail(res, "Invalid credentials", 401);

  const token = signAuthToken({ userId: user._id.toString(), email: user.email });
  setAuthCookie(res, token);

  return ok(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      preferredMode: user.preferredMode,
      greenPoints: user.greenPoints,
      badges: user.badges,
      publicProfileUrl: `/u/${user._id}`
    }
  });
}));

router.post("/signup", asyncHandler(async (req, res) => {
  const body = signupSchema.parse(req.body);
  await connectToDatabase();

  const existing = await User.findOne({ email: body.email.toLowerCase() }).lean();
  if (existing) return fail(res, "Email already registered", 409);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    name: body.name,
    email: body.email.toLowerCase(),
    passwordHash,
    authProvider: "local",
    preferredMode: body.preferredMode || "car"
  });

  const token = signAuthToken({ userId: user._id.toString(), email: user.email });
  setAuthCookie(res, token);

  return ok(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      preferredMode: user.preferredMode,
      publicProfileUrl: `/u/${user._id}`
    }
  }, 201);
}));

router.post("/google", asyncHandler(async (req, res) => {
  const profile = await verifyGoogleIdToken(req.body?.credential);
  await connectToDatabase();

  let user = await User.findOne({ email: profile.email.toLowerCase() });
  if (!user) {
    user = await User.create({
      name: profile.name,
      email: profile.email.toLowerCase(),
      authProvider: "google",
      googleId: profile.sub,
      avatarUrl: profile.picture,
      preferredMode: "car"
    });
  } else {
    if (user.authProvider !== "google") user.authProvider = "google";
    user.name = profile.name || user.name;
    user.avatarUrl = profile.picture || user.avatarUrl;
    user.googleId = profile.sub || user.googleId;
    await user.save();
  }

  const token = signAuthToken({ userId: user._id.toString(), email: user.email });
  setAuthCookie(res, token);

  return ok(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferredMode: user.preferredMode,
      greenPoints: user.greenPoints,
      badges: user.badges,
      publicProfileUrl: `/u/${user._id}`
    }
  });
}));

router.post("/otp/request", asyncHandler(async (req, res) => {
  const body = otpRequestSchema.parse(req.body);
  const phone = normalizePhone(body.phone);
  if (!phone || phone.length < 10) return fail(res, "Valid phone number required", 422);

  await connectToDatabase();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await OtpCode.create({ phone, code, expiresAt });

  return ok(res, {
    success: true,
    message: "OTP generated",
    devOtp: process.env.NODE_ENV === "production" ? undefined : code
  });
}));

router.post("/otp/verify", asyncHandler(async (req, res) => {
  const body = otpVerifySchema.parse(req.body);
  const phone = normalizePhone(body.phone);
  const otp = String(body.otp || "").trim();
  const name = String(body.name || "Phone User").trim();

  if (!phone || phone.length < 10 || otp.length < 4) return fail(res, "Phone and OTP required", 422);

  await connectToDatabase();
  const record = await OtpCode.findOne({ phone, code: otp, consumed: false }).sort({ createdAt: -1 });
  if (!record) return fail(res, "Invalid OTP", 401);
  if (record.expiresAt.getTime() < Date.now()) return fail(res, "OTP expired", 401);

  record.consumed = true;
  await record.save();

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name,
      phone,
      email: syntheticEmail(phone),
      authProvider: "local",
      preferredMode: "bike"
    });
  }

  const token = signAuthToken({ userId: user._id.toString(), email: user.email });
  setAuthCookie(res, token);

  return ok(res, {
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      publicProfileUrl: `/u/${user._id}`
    }
  });
}));

router.post("/logout", asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return ok(res, { success: true });
}));

router.get("/me", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Unauthorized", 401);

  await connectToDatabase();
  const [user, stats] = await Promise.all([
    User.findById(auth.userId).lean(),
    TripStat.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(auth.userId) } },
      { $group: { _id: null, trips: { $sum: 1 }, totalCo2Saved: { $sum: "$co2SavedGrams" } } }
    ])
  ]);

  if (!user) return fail(res, "User not found", 404);
  const tripSummary = stats[0] || { trips: 0, totalCo2Saved: 0 };
  const rating = computeProfileRating({
    greenPoints: user.greenPoints,
    totalCo2Saved: tripSummary.totalCo2Saved,
    trips: tripSummary.trips
  });

  return ok(res, {
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
}));

export default router;
