import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, UserRole } from "@prisma/client";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

// This is an Argon2id hash of an arbitrary development-only value. Verifying it
// for an unknown/inactive user avoids making a failed login substantially cheaper.
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=2$5Ti+Rb525G1x3uwW2SLImg$Ix8g/vNr5Kbx+Oh9Wnpde2JH0WRmUvU1TeFI1zYTjIE";

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthenticatedRequest = Request & {
  auth?: { user: AuthenticatedUser; expiresAt: Date; tokenHash: string };
};

export function configuredClientOrigin() {
  return process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordError(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    return "Password must be between 12 and 128 characters.";
  }
  return null;
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now = new Date()) {
  return new Date(now.getTime() + SESSION_MAX_AGE_MS);
}

export function readSessionToken(request: Request) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name !== SESSION_COOKIE || value.length === 0) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie(SESSION_COOKIE, token, { ...cookieOptions(SESSION_MAX_AGE_MS), expires: expiresAt });
}

export function clearSessionCookie(response: Response) {
  response.cookie(SESSION_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
}

export function noStore(response: Response) {
  response.set("Cache-Control", "no-store");
}

export function originIsAllowed(request: Request) {
  return request.get("origin") === configuredClientOrigin();
}

export function requireAllowedOrigin(request: Request, response: Response) {
  if (originIsAllowed(request)) return true;
  response.status(403).json({ error: "Request origin is not permitted.", code: "ORIGIN_FORBIDDEN" });
  return false;
}

export function identity(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} as const;

export async function loadAuthentication(prisma: PrismaClient, request: AuthenticatedRequest) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, user: { select: sessionUserSelect } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    return null;
  }
  return { user: session.user, expiresAt: session.expiresAt, tokenHash };
}

export function authenticate(prisma: PrismaClient) {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    try {
      const auth = await loadAuthentication(prisma, request);
      if (!auth) {
        noStore(response);
        response.status(401).json({ error: "Authentication is required.", code: "UNAUTHENTICATED" });
        return;
      }
      request.auth = auth;
      next();
    } catch {
      response.status(500).json({ error: "Unable to authenticate request." });
    }
  };
}

export function requirePasswordChanged(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  if (request.auth?.user.mustChangePassword) {
    noStore(response);
    response.status(403).json({ error: "A password change is required before using this feature.", code: "PASSWORD_CHANGE_REQUIRED" });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.auth || !roles.includes(request.auth.user.role)) {
      noStore(response);
      response.status(403).json({ error: "Access denied.", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}

type LoginAttempt = { failures: number; startedAt: number };

export class LoginLimiter {
  private readonly attempts = new Map<string, LoginAttempt>();
  constructor(private readonly windowMs = 15 * 60 * 1000, private readonly clock = () => Date.now()) {}

  key(email: string, ip: string) { return `${email}\u0000${ip}`; }

  retryAfter(email: string, ip: string) {
    const entry = this.attempts.get(this.key(email, ip));
    if (!entry) return 0;
    const remaining = entry.startedAt + this.windowMs - this.clock();
    if (remaining <= 0) {
      this.attempts.delete(this.key(email, ip));
      return 0;
    }
    return entry.failures >= 5 ? Math.ceil(remaining / 1000) : 0;
  }

  failure(email: string, ip: string) {
    const key = this.key(email, ip);
    const now = this.clock();
    const previous = this.attempts.get(key);
    const entry = !previous || previous.startedAt + this.windowMs <= now
      ? { failures: 1, startedAt: now }
      : { ...previous, failures: previous.failures + 1 };
    this.attempts.set(key, entry);
    return entry.failures;
  }

  success(email: string, ip: string) {
    this.attempts.delete(this.key(email, ip));
  }
}

export const loginLimiter = new LoginLimiter();

export async function verifyPassword(passwordHash: string | null, password: string) {
  try {
    return await argon2.verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string) {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}
