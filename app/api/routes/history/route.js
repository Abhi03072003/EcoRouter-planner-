export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import Route from "@/models/Route";

export async function GET() {
  const auth = getUserFromRequest();
  if (!auth?.userId) {
    return fail("Unauthorized", 401);
  }

  await connectToDatabase();
  const routes = await Route.find({ userId: auth.userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return ok({ routes });
}
