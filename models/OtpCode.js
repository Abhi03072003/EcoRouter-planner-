import mongoose from "mongoose";

const OtpCodeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.models.OtpCode || mongoose.model("OtpCode", OtpCodeSchema);
