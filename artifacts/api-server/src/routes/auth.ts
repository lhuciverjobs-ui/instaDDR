import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const router: IRouter = Router();

const AUTH_COOKIE = "app_auth";
const AUTH_TTL_MS = 1000 * 60 * 60 * 12;
const isProduction = process.env.NODE_ENV === "production";
const appPassword = process.env.APP_PASSWORD ?? (isProduction ? "" : "dev-password");
const authSecret = process.env.AUTH_SECRET ?? (isProduction ? "" : "dev-auth-secret");

if (isProduction && (!appPassword || !authSecret)) {
  throw new Error("APP_PASSWORD and AUTH_SECRET must be set in production");
}

function sign(value: string): string {
  return createHmac("sha256", authSecret).update(value).digest("base64url");
}

function makeToken(): string {
  const expiresAt = Date.now() + AUTH_TTL_MS;
  const nonce = randomUUID();
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresAtRaw, nonce, mac] = parts;
  if (!expiresAtRaw || !nonce || !mac) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  return safeEqual(sign(`${expiresAtRaw}.${nonce}`), mac);
}

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    maxAge: AUTH_TTL_MS,
    path: "/",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (verifyToken(req.cookies?.[AUTH_COOKIE])) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
}

router.get("/auth/status", (req, res) => {
  res.json({ authenticated: verifyToken(req.cookies?.[AUTH_COOKIE]) });
});

router.post("/auth/login", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!appPassword || !safeEqual(password, appPassword)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  res.cookie(AUTH_COOKIE, makeToken(), authCookieOptions());
  res.json({ authenticated: true });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.json({ authenticated: false });
});

export default router;
