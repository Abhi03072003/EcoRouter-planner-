export const dynamic = "force-dynamic";

import { ok } from "@/lib/http";
import { connectToDatabase } from "@/lib/mongodb";

function boolEnv(name) {
  return Boolean(process.env[name]);
}

export async function GET() {
  const checks = {
    mongo: false,
    openWeather: boolEnv("OPENWEATHER_API_KEY"),
    osrmBase: boolEnv("OSRM_BASE_URL"),
    googleOAuth: boolEnv("GOOGLE_CLIENT_ID") && boolEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
    emailNotify: boolEnv("RESEND_API_KEY") && boolEnv("FROM_EMAIL") && boolEnv("ADMIN_EMAIL"),
    aiChatbot: boolEnv("OPENAI_API_KEY")
  };

  try {
    await connectToDatabase();
    checks.mongo = true;
  } catch {
    checks.mongo = false;
  }

  const readinessScore = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
  );

  return ok({
    status: readinessScore >= 70 ? "ready" : "partial",
    readinessScore,
    checks,
    timestamp: new Date().toISOString()
  });
}
