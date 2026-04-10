import mongoose from "mongoose";

const HelpRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userPhone: { type: String, default: "" },
    issueType: { type: String, required: true },
    message: { type: String, required: true, maxlength: 1200 },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" }
  },
  { timestamps: true }
);

export default mongoose.models.HelpRequest || mongoose.model("HelpRequest", HelpRequestSchema);
