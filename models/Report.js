import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["traffic", "smoke", "flood", "roadblock"],
      required: true
    },
    location: {
      lat: Number,
      lon: Number
    },
    severity: { type: Number, min: 1, max: 5, required: true },
    status: {
      type: String,
      enum: ["open", "verified", "resolved"],
      default: "open"
    }
  },
  { timestamps: true }
);

ReportSchema.index({ "location.lat": 1, "location.lon": 1, createdAt: -1 });

export default mongoose.models.Report || mongoose.model("Report", ReportSchema);
