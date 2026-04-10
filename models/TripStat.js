import mongoose from "mongoose";

const TripStatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true
    },
    baselineCo2Grams: { type: Number, required: true },
    selectedCo2Grams: { type: Number, required: true },
    co2SavedGrams: { type: Number, required: true },
    timeSavedMin: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.TripStat || mongoose.model("TripStat", TripStatSchema);
