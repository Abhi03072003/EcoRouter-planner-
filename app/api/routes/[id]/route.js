export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import Route from "@/models/Route";

export async function GET(_request, { params }) {
  const auth = getUserFromRequest();
  if (!auth?.userId) {
    return fail("Unauthorized", 401);
  }

  await connectToDatabase();
  const route = await Route.findOne({ _id: params.id, userId: auth.userId }).lean();

  if (!route) {
    return fail("Route not found", 404);
  }

  return ok({ route });
}
