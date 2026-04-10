import jwt from "jsonwebtoken";

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

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/"
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function getAuthTokenFromRequest(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return null;
}

export function getUserFromRequest(req) {
  const token = getAuthTokenFromRequest(req);
  if (!token) return null;

  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const auth = getUserFromRequest(req);
  if (!auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.auth = auth;
  next();
}
