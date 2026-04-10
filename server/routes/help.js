import express from "express";
import { connectToDatabase } from "../../lib/mongodb.js";
import { helpChatSchema, helpCreateSchema } from "../../lib/validators.js";
import { notifyAdmin } from "../../lib/notify.js";
import User from "../../models/User.js";
import HelpRequest from "../../models/HelpRequest.js";
import { asyncHandler, fail, ok } from "../lib/http.js";
import { getUserFromRequest } from "../lib/auth.js";

const router = express.Router();
const CUSTOMER_CARE_PHONE = process.env.CUSTOMER_CARE_PHONE || "+916394323401";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "pandeyharsh73099@gmail.com";

const fallbackKnowledge = [
  {
    keys: ["login", "signin", "sign in", "otp", "google"],
    answer: "Login issue: check internet, verify credentials or OTP, and ensure Google Client ID is configured."
  },
  {
    keys: ["map", "location", "route", "tracking"],
    answer: "Map issue: allow location permission, verify source and destination text, then retry route search."
  },
  {
    keys: ["review", "comment"],
    answer: "Review issue: sign in first, then submit rating (1-5) and a comment with at least 4 characters."
  },
  {
    keys: ["dashboard", "carbon", "population", "aqi"],
    answer: "Dashboard values are live estimates using AQI, traffic, weather, and short-term projections."
  }
];

function classifyIssue(message) {
  const lower = message.toLowerCase();
  if (["login", "signin", "otp", "password", "google"].some((k) => lower.includes(k))) return "Login issue";
  if (["map", "location", "route", "tracking", "pin"].some((k) => lower.includes(k))) return "Map issue";
  if (["payment", "refund", "billing"].some((k) => lower.includes(k))) return "Payment / account";
  return "Other";
}

function getFallbackReply(message) {
  const lower = message.toLowerCase();
  const match = fallbackKnowledge.find((item) => item.keys.some((key) => lower.includes(key)));
  return match?.answer || "Thanks. We received your issue. Please share more details in the Help section for human support.";
}

async function getAiReply(message, history = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const historyText = history.slice(-6).map((entry) => `${entry.role}: ${entry.content}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "You are EcoRoute support assistant. Respond in user language (Hindi/Hinglish/English). Return JSON only with keys: reply, issueType, suggestedMessage. Keep reply concise and actionable. issueType must be one of: Map issue, Login issue, Route mismatch, Payment / account, Other."
        },
        { role: "user", content: `Conversation:\n${historyText}\n\nCurrent user message:\n${message}` }
      ],
      max_output_tokens: 220,
      temperature: 0.3
    })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const textRaw = payload?.output_text || payload?.output?.[0]?.content?.find?.((item) => item.type === "output_text")?.text || null;
  if (!textRaw) return null;

  try {
    const parsed = JSON.parse(String(textRaw).trim());
    if (!parsed?.reply) return null;
    return {
      reply: String(parsed.reply).trim(),
      issueType: String(parsed.issueType || "Other"),
      suggestedMessage: String(parsed.suggestedMessage || message).trim()
    };
  } catch {
    return null;
  }
}

router.get("/", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Login required", 401);

  await connectToDatabase();
  const tickets = await HelpRequest.find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(20).lean();
  return ok(res, {
    tickets,
    support: {
      customerCarePhone: CUSTOMER_CARE_PHONE,
      supportEmail: SUPPORT_EMAIL
    }
  });
}));

router.post("/", asyncHandler(async (req, res) => {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) return fail(res, "Login required", 401);

  const body = helpCreateSchema.parse(req.body);
  await connectToDatabase();
  const user = await User.findById(auth.userId).lean();
  if (!user) return fail(res, "User not found", 404);

  const ticket = await HelpRequest.create({
    userId: user._id,
    userName: user.name,
    userEmail: user.email,
    userPhone: (body.phone || "").trim(),
    issueType: body.issueType,
    message: body.message.trim()
  });

  await notifyAdmin({
    subject: `Help Request: ${body.issueType}`,
    text: `User: ${user.name} (${user.email})\nPhone: ${(body.phone || "").trim()}\nMessage: ${body.message.trim()}`,
    html: `<p><strong>User:</strong> ${user.name} (${user.email})</p><p><strong>Phone:</strong> ${(body.phone || "").trim()}</p><p><strong>Issue:</strong> ${body.issueType}</p><p>${body.message.trim()}</p>`
  });

  return ok(res, {
    ticket,
    support: {
      customerCarePhone: CUSTOMER_CARE_PHONE,
      supportEmail: SUPPORT_EMAIL,
      callLink: `tel:${CUSTOMER_CARE_PHONE}`,
      mailLink: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help: ${body.issueType}`)}`
    }
  }, 201);
}));

router.post("/chat", asyncHandler(async (req, res) => {
  const body = helpChatSchema.parse(req.body);
  const message = String(body.message || "").trim();
  const history = body.history || [];
  if (!message) return fail(res, "message is required", 422);

  const aiResult = await getAiReply(message, history);
  const issueType = aiResult?.issueType || classifyIssue(message);
  const suggestedMessage = aiResult?.suggestedMessage || message;

  return ok(res, {
    reply: aiResult?.reply || getFallbackReply(message),
    source: aiResult ? "openai" : "fallback",
    issueType,
    suggestedMessage
  });
}));

export default router;
