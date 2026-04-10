import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    name: String,
    lat: Number,
    lon: Number
  },
  { _id: false }
);

const AlternativeSchema = new mongoose.Schema(
  {
    providerRouteId: String,
    label: {
      type: String,
      enum: ["fastest", "shortest", "greenest"]
    },
    distanceKm: Number,
    durationMin: Number,
    avgAqi: Number,
    trafficIndex: Number,
    weatherRisk: Number,
    co2Grams: Number,
    ecoScore: Number,
    riskScore: Number,
    polyline: String,
    category: String,
    explain: {
      distancePct: Number,
      aqiPct: Number,
      trafficPct: Number,
      weatherPct: Number,
      co2Pct: Number
    }
  },
  { _id: false }
);

const RouteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    source: LocationSchema,
    destination: LocationSchema,
    mode: {
      type: String,
      enum: ["car", "bike", "ev", "walk", "cycle", "transit"],
      default: "car"
    },
    alternatives: [AlternativeSchema],
    selectedRouteIndex: { type: Number, default: 0 },
    saved: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.Route || mongoose.model("Route", RouteSchema);
