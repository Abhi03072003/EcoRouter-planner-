export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail, parseBodyError } from "@/lib/http";
import { setAuthCookie, signAuthToken } from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import User from "@/models/User";

export async function POST(request) {
  try {
    const body = signupSchema.parse(await request.json());
    await connectToDatabase();

    const existing = await User.findOne({ email: body.email.toLowerCase() }).lean();
    if (existing) return fail("Email already registered", 409);

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      authProvider: "local",
      preferredMode: body.preferredMode || "car"
    });

    const token = signAuthToken({ userId: user._id.toString(), email: user.email });
    setAuthCookie(token);

    return ok({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferredMode: user.preferredMode,
        publicProfileUrl: `/u/${user._id}`
      }
    }, 201);
  } catch (error) {
    return parseBodyError(error);
  }
}
