export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { reportSchema } from "@/lib/validators";
import Report from "@/models/Report";

export async function POST(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) {
      return fail("Unauthorized", 401);
    }

    const body = reportSchema.parse(await request.json());

    await connectToDatabase();
    const report = await Report.create({
      userId: auth.userId,
      type: body.type,
      location: body.location,
      severity: body.severity
    });

    return ok({ reportId: report._id }, 201);
  } catch (error) {
    return parseBodyError(error);
  }
}
