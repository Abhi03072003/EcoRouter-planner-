export const dynamic = "force-dynamic";

import { planRouteSchema } from "@/lib/validators";
import { parseBodyError, ok } from "@/lib/http";
import { planRoutes } from "@/services/routePlanner";

export async function POST(request) {
  try {
    const body = planRouteSchema.parse(await request.json());
    const result = await planRoutes(body);

    return ok({
      source: body.source,
      destination: body.destination,
      mode: body.mode,
      alternatives: result.alternatives,
      baselineFastestCo2Grams: result.baselineFastestCo2Grams,
      recommendation: result.recommendation,
      liveContext: result.liveContext
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
