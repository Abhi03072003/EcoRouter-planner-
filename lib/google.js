import { fetchJson } from "./fetcher.js";
import { AppError } from "./errors.js";

export async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new AppError("Missing Google credential", 422);
  }

  const payload = await fetchJson(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { timeoutMs: 8000, retries: 1 }
  );

  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Missing GOOGLE_CLIENT_ID in environment", 500);
  }

  if (payload.aud !== clientId) {
    throw new AppError("Google token audience mismatch", 401);
  }

  if (payload.email_verified !== "true") {
    throw new AppError("Google email not verified", 401);
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || ""
  };
}
