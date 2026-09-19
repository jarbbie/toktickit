import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hashPassword, hashSessionToken, sessionExpiry } from "../../src/auth.js";

const prisma = vi.hoisted(() => {
  const transaction = {
    session: { create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    user: { update: vi.fn() },
  };
  return {
    user: { findUnique: vi.fn() },
    session: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    transaction,
  };
});

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const origin = "http://localhost:5173";
const password = "Lab3-Initial-2026!";
const user = {
  id: 7, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER" as const,
  isActive: true, mustChangePassword: true,
};

function authenticatedSession(overrides: Partial<typeof user> = {}) {
  return {
    expiresAt: sessionExpiry(),
    user: { ...user, ...overrides },
  };
}

describe("Lab 3 authentication API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma.transaction) => unknown) => callback(prisma.transaction));
  });

  it("logs in an active user with a normalized email, opaque HttpOnly cookie, and safe identity", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: await hashPassword(password) });
    prisma.session.findUnique.mockResolvedValue(null);

    const response = await request(app).post("/api/auth/login").set("Origin", origin)
      .send({ email: "  NICHA@TokTickIT.Test ", password });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(user);
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["set-cookie"]?.[0]).toContain("toktickit_session=");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email } }));
    expect(prisma.transaction.session.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      userId: user.id,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }) }));
  });

  it("uses the same safe failure for unknown, inactive, and wrong credentials", async () => {
    const cases = [
      null,
      { ...user, isActive: false, passwordHash: await hashPassword(password) },
      { ...user, passwordHash: await hashPassword("Different-Lab3-Pass!") },
    ];
    for (const account of cases) {
      prisma.user.findUnique.mockResolvedValueOnce(account);
      const response = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: user.email, password });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unable to sign in. Check your credentials or contact an administrator.", code: "INVALID_CREDENTIALS" });
    }
  });

  it("rejects foreign login origins before credential lookup and throttles after five failures", async () => {
    const foreign = await request(app).post("/api/auth/login").set("Origin", "https://attacker.example").send({ email: user.email, password });
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe("ORIGIN_FORBIDDEN");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue(null);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request(app).post("/api/auth/login").set("Origin", origin).send({ email: "limit@toktickit.test", password })).status).toBe(401);
    }
    const throttled = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: "limit@toktickit.test", password });
    expect(throttled.status).toBe(429);
    expect(throttled.headers["retry-after"]).toMatch(/^\d+$/);
  });

  it("returns the current identity and changes a password atomically with a replacement session", async () => {
    const token = "current-session-token";
    prisma.session.findUnique.mockResolvedValue(authenticatedSession());
    const me = await request(app).get("/api/auth/me").set("Cookie", `toktickit_session=${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual(user);

    const currentHash = await hashPassword(password);
    prisma.user.findUnique.mockResolvedValue({ passwordHash: currentHash });
    prisma.transaction.user.update.mockResolvedValue({ ...user, mustChangePassword: false });
    const changed = await request(app).post("/api/auth/change-password").set("Origin", origin)
      .set("Cookie", `toktickit_session=${token}`).send({ currentPassword: password, newPassword: "My-New-Lab3-Pass!" });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(prisma.transaction.session.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(prisma.transaction.session.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }) }));
  });

  it("clears a logout cookie even if there is no valid server session", async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]?.[0]).toContain("toktickit_session=;");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(prisma.session.delete).not.toHaveBeenCalled();
  });

  it("does not treat a raw session token as a stored database credential", () => {
    const token = "a-token";
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
