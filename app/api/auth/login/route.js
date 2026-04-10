export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail, parseBodyError } from "@/lib/http";
import { setAuthCookie, signAuthToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import User from "@/models/User";

export async function POST(request) {
  try {
    const body = loginSchema.parse(await request.json());
    await connectToDatabase();

    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (!user) return fail("Invalid credentials", 401);
    if (user.authProvider !== "local") {
      return fail("This account uses Google sign-in.", 403);
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash || "");
    if (!validPassword) return fail("Invalid credentials", 401);

    const token = signAuthToken({ userId: user._id.toString(), email: user.email });
    setAuthCookie(token);

    return ok({
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
  } catch (error) {
    return parseBodyError(error);
  }
}
