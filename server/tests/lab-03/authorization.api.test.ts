import express from "express";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { authenticate, requirePasswordChanged, requireRole } from "../../src/auth.js";

const origin = "http://localhost:5173";
const expiresAt = new Date("2099-01-01T00:00:00.000Z");

function protectedApp(role: "REQUESTER" | "IT_STAFF", mustChangePassword = false) {
  const prisma = {
    session: {
      findUnique: async () => ({
        expiresAt,
        user: { id: 1, name: "Test User", email: "test@toktickit.test", role, isActive: true, mustChangePassword },
      }),
    },
  } as unknown as PrismaClient;
  const result = express();
  result.get("/password-gated", authenticate(prisma), requirePasswordChanged, (_req, res) => res.json({ ok: true }));
  result.get("/staff-only", authenticate(prisma), requirePasswordChanged, requireRole("IT_STAFF", "ADMINISTRATOR"), (_req, res) => res.json({ ok: true }));
  return result;
}

describe("Lab 3 authorization foundation", () => {
  it("uses credentialed CORS only for the configured client and rejects login CSRF", async () => {
    const preflight = await request(app).options("/api/auth/login")
      .set("Origin", origin).set("Access-Control-Request-Method", "POST");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");

    const foreign = await request(app).post("/api/auth/login")
      .set("Origin", "https://attacker.example")
      .send({ email: "user@toktickit.test", password: "Lab3-Initial-2026!" });
    expect(foreign.status).toBe(403);
    expect(foreign.body).toEqual({ error: "Request origin is not permitted.", code: "ORIGIN_FORBIDDEN" });
  });

  it("enforces authentication, mandatory password change, and roles server-side", async () => {
    const staff = protectedApp("IT_STAFF");
    expect((await request(staff).get("/password-gated")).status).toBe(401);
    expect((await request(staff).get("/staff-only").set("Cookie", "toktickit_session=token")).status).toBe(200);

    const initialPassword = protectedApp("REQUESTER", true);
    expect((await request(initialPassword).get("/password-gated").set("Cookie", "toktickit_session=token")).status).toBe(403);

    const requester = protectedApp("REQUESTER");
    expect((await request(requester).get("/staff-only").set("Cookie", "toktickit_session=token")).status).toBe(403);
  });
});
