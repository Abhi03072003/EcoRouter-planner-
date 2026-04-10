import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";

const AUTH_COOKIE = "ecoroute_token";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment");
  }
  return secret;
}

export function signAuthToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function setAuthCookie(token) {
  cookies().set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
}

export function clearAuthCookie() {
  cookies().set(AUTH_COOKIE, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });
}

export function getAuthTokenFromCookie() {
  return cookies().get(AUTH_COOKIE)?.value;
}

export function getAuthTokenFromHeader() {
  const value = headers().get("authorization") || "";
  if (!value.startsWith("Bearer ")) {
    return null;
  }
  return value.slice("Bearer ".length).trim();
}

export function getUserFromRequest() {
  const token = getAuthTokenFromCookie() || getAuthTokenFromHeader();
  if (!token) {
    return null;
  }

  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}
