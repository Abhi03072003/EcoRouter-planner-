export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail, parseBodyError } from "@/lib/http";
import { otpRequestSchema } from "@/lib/validators";
import OtpCode from "@/models/OtpCode";

function normalizePhone(raw) {
  return String(raw || "").replace(/[^0-9+]/g, "").slice(0, 16);
}

export async function POST(request) {
  try {
    const body = otpRequestSchema.parse(await request.json());
    const phone = normalizePhone(body.phone);
    if (!phone || phone.length < 10) return fail("Valid phone number required", 422);

    await connectToDatabase();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpCode.create({ phone, code, expiresAt });

    return ok({
      success: true,
      message: "OTP generated",
      devOtp: process.env.NODE_ENV === "production" ? undefined : code
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
