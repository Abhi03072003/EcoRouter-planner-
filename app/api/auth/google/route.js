export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { ok, parseBodyError } from "@/lib/http";
import { setAuthCookie, signAuthToken } from "@/lib/auth";
import { verifyGoogleIdToken } from "@/lib/google";
import User from "@/models/User";

export async function POST(request) {
  try {
    const body = await request.json();
    const profile = await verifyGoogleIdToken(body?.credential);

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
      // If account exists with same verified email (local/otp), link it to Google.
      // This avoids login failures when users switch auth methods.
      if (user.authProvider !== "google") {
        user.authProvider = "google";
      }
      user.name = profile.name || user.name;
      user.avatarUrl = profile.picture || user.avatarUrl;
      user.googleId = profile.sub || user.googleId;
      await user.save();
    }

    const token = signAuthToken({ userId: user._id.toString(), email: user.email });
    setAuthCookie(token);

    return ok({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        preferredMode: user.preferredMode,
        greenPoints: user.greenPoints,
        badges: user.badges
      }
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
