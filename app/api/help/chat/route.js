export const dynamic = "force-dynamic";

import { ok, fail, parseBodyError } from "@/lib/http";
import { helpChatSchema } from "@/lib/validators";

const fallbackKnowledge = [
  {
    keys: ["login", "signin", "sign in", "otp", "google"],
    answer:
      "Login issue: check internet, verify credentials/OTP, and ensure Google Client ID is configured in .env.local."
  },
  {
    keys: ["map", "location", "route", "tracking"],
    answer:
      "Map issue: allow location permission, verify source/destination text, and retry route search."
  },
  {
    keys: ["review", "comment"],
    answer: "Review issue: sign in first, then submit rating (1-5) and comment with minimum 4 characters."
  },
  {
    keys: ["dashboard", "carbon", "population", "aqi"],
    answer:
      "Dashboard values are live estimates using current AQI/traffic/weather with short-term projection."
  }
];

function classifyIssue(message) {
  const lower = message.toLowerCase();
  if (["login", "signin", "otp", "password", "google"].some((k) => lower.includes(k))) return "Login issue";
  if (["map", "location", "route", "tracking", "pin"].some((k) => lower.includes(k))) return "Map issue";
  if (["payment", "refund", "billing"].some((k) => lower.includes(k))) return "Payment / account";
  return "Other";
}

async function getAiReply(message, history = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const historyText = history
    .slice(-6)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

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
          content:
            "You are EcoRoute support assistant. Respond in user language (Hindi/Hinglish/English). Return JSON only with keys: reply, issueType, suggestedMessage. Keep reply concise and actionable. issueType must be one of: Map issue, Login issue, Route mismatch, Payment / account, Other."
        },
        { role: "user", content: `Conversation:\n${historyText}\n\nCurrent user message:\n${message}` }
      ],
      max_output_tokens: 220,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();

  const textRaw =
    payload?.output_text ||
    payload?.output?.[0]?.content?.find?.((c) => c.type === "output_text")?.text ||
    null;

  if (!textRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(String(textRaw).trim());
    if (!parsed?.reply) {
      return null;
    }
    return {
      reply: String(parsed.reply).trim(),
      issueType: String(parsed.issueType || "Other"),
      suggestedMessage: String(parsed.suggestedMessage || message).trim()
    };
  } catch {
    return null;
  }
}

function getFallbackReply(message) {
  const lower = message.toLowerCase();
  const match = fallbackKnowledge.find((item) => item.keys.some((k) => lower.includes(k)));
  return (
    match?.answer ||
    "Thanks. We received your issue. Please share details in Help section for human support callback."
  );
}

export async function POST(request) {
  try {
    const body = helpChatSchema.parse(await request.json());
    const message = String(body.message || "").trim();
    const history = body.history || [];
    if (!message) return fail("message is required", 422);

    const aiResult = await getAiReply(message, history);
    const issueType = aiResult?.issueType || classifyIssue(message);
    const suggestedMessage = aiResult?.suggestedMessage || message;

    return ok({
      reply: aiResult?.reply || getFallbackReply(message),
      source: aiResult ? "openai" : "fallback",
      issueType,
      suggestedMessage
    });
  } catch (error) {
    return parseBodyError(error);
  }
}
