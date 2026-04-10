export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail, parseBodyError } from "@/lib/http";
import { setAuthCookie, signAuthToken } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/validators";
import OtpCode from "@/models/OtpCode";
import User from "@/models/User";

function normalizePhone(raw) {
  return String(raw || "").replace(/[^0-9+]/g, "").slice(0, 16);
}

function syntheticEmail(phone) {
  const clean = phone.replace(/[^0-9]/g, "");
  return `phone_${clean}@otp.local`;
}

export async function POST(request) {
  try {
    const body = otpVerifySchema.parse(await request.json());
    const phone = normalizePhone(body.phone);
    const otp = String(body.otp || "").trim();
    const name = String(body.name || "Phone User").trim();

    if (!phone || phone.length < 10 || otp.length < 4) {
      return fail("Phone and OTP required", 422);
    }

    await connectToDatabase();

    const record = await OtpCode.findOne({ phone, code: otp, consumed: false }).sort({ createdAt: -1 });
    if (!record) return fail("Invalid OTP", 401);
    if (record.expiresAt.getTime() < Date.now()) return fail("OTP expired", 401);

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
    setAuthCookie(token);

    return ok({
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        publicProfileUrl: `/u/${user._id}`
      }
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
