import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, default: "" },
    authProvider: {
      type: String,
      enum: ["google", "local"],
      default: "google"
    },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: { type: String },
    bio: { type: String, default: "Eco-conscious traveler" },
    city: { type: String, default: "" },
    phone: { type: String, default: "" },
    preferredMode: {
      type: String,
      enum: ["car", "bike", "ev", "walk", "cycle", "transit"],
      default: "car"
    },
    homeLocation: {
      name: String,
      lat: Number,
      lon: Number
    },
    greenPoints: { type: Number, default: 0 },
    badges: { type: [String], default: [] }
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
