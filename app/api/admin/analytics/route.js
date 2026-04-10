export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { ok } from "@/lib/http";
import Report from "@/models/Report";
import TripStat from "@/models/TripStat";

export async function GET() {
  await connectToDatabase();

  const [reportBreakdown, savings] = await Promise.all([
    Report.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 }, avgSeverity: { $avg: "$severity" } } },
      { $sort: { count: -1 } }
    ]),
    TripStat.aggregate([
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          totalCo2Saved: { $sum: "$co2SavedGrams" },
          avgCo2Saved: { $avg: "$co2SavedGrams" }
        }
      }
    ])
  ]);

  return ok({
    reportBreakdown,
    tripAnalytics: savings[0] || {
      totalTrips: 0,
      totalCo2Saved: 0,
      avgCo2Saved: 0
    }
  });
}
