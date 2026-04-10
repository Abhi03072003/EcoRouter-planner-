export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { notifyAdmin } from "@/lib/notify";
import { helpCreateSchema } from "@/lib/validators";
import User from "@/models/User";
import HelpRequest from "@/models/HelpRequest";

const CUSTOMER_CARE_PHONE = process.env.CUSTOMER_CARE_PHONE || "+916394323401";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "pandeyharsh73099@gmail.com";

export async function GET() {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) return fail("Login required", 401);

    await connectToDatabase();

    const tickets = await HelpRequest.find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(20).lean();

    return ok({
      tickets,
      support: {
        customerCarePhone: CUSTOMER_CARE_PHONE,
        supportEmail: SUPPORT_EMAIL
      }
    });
  } catch (error) {
    return parseBodyError(error);
  }
}

export async function POST(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) return fail("Login required", 401);

    const body = helpCreateSchema.parse(await request.json());
    const issueType = body.issueType;
    const message = body.message.trim();
    const phone = (body.phone || "").trim();

    await connectToDatabase();
    const user = await User.findById(auth.userId).lean();
    if (!user) return fail("User not found", 404);

    const ticket = await HelpRequest.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userPhone: phone,
      issueType,
      message
    });

    await notifyAdmin({
      subject: `Help Request: ${issueType}`,
      text: `User: ${user.name} (${user.email})\nPhone: ${phone}\nMessage: ${message}`,
      html: `<p><strong>User:</strong> ${user.name} (${user.email})</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Issue:</strong> ${issueType}</p><p>${message}</p>`
    });

    return ok(
      {
        ticket,
        support: {
          customerCarePhone: CUSTOMER_CARE_PHONE,
          supportEmail: SUPPORT_EMAIL,
          callLink: `tel:${CUSTOMER_CARE_PHONE}`,
          mailLink: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help: ${issueType}`)}`
        }
      },
      201
    );
  } catch (error) {
    return parseBodyError(error);
  }
}
