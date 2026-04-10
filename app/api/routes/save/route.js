export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ok, fail, parseBodyError } from "@/lib/http";
import { saveRouteSchema } from "@/lib/validators";
import Route from "@/models/Route";

export async function POST(request) {
  try {
    const auth = getUserFromRequest();
    if (!auth?.userId) {
      return fail("Unauthorized", 401);
    }

    const body = saveRouteSchema.parse(await request.json());

    await connectToDatabase();
    const route = await Route.create({
      userId: auth.userId,
      source: body.source,
      destination: body.destination,
      mode: body.mode,
      alternatives: body.alternatives,
      selectedRouteIndex: body.selectedRouteIndex,
      saved: true
    });

    return ok({ routeId: route._id }, 201);
  } catch (error) {
    return parseBodyError(error);
  }
}
