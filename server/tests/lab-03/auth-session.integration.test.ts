import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { hashPassword, hashSessionToken, sessionExpiry } from "../../src/auth.js";
import { setPrismaForTests } from "../../src/prisma.js";

const origin = "http://localhost:5173";
const password = "Lab3-Initial-2026!";
const schema = `lab3_auth_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.set("schema", schema);
const adminUrl = new URL(process.env.DATABASE_URL!);
adminUrl.searchParams.delete("schema");
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
const prisma = new PrismaClient({ datasourceUrl: databaseUrl.toString() });

async function createSchema() {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await prisma.$executeRawUnsafe('CREATE TYPE "UserRole" AS ENUM (\'REQUESTER\', \'IT_STAFF\', \'ADMINISTRATOR\')');
  await prisma.$executeRawUnsafe(`CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE,
    "role" "UserRole" NOT NULL DEFAULT 'REQUESTER', "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "Session" (
    "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

describe("Lab 3 authentication session integration", () => {
  beforeAll(async () => {
    await createSchema();
    setPrismaForTests(prisma);
  });

  afterAll(async () => {
    setPrismaForTests(null);
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  });

  it("persists only token hashes and atomically revokes old sessions on a password change", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Integration Requester", email: "integration.requester@toktickit.test",
        passwordHash: await hashPassword(password), mustChangePassword: true,
      },
    });
    const extraRawToken = "extra-session-token-for-revocation";
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(extraRawToken), expiresAt: sessionExpiry() } });

    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").set("Origin", origin)
      .send({ email: " INTEGRATION.REQUESTER@TOKTICKIT.TEST ", password });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    const storedTokens = await prisma.session.findMany({ where: { userId: user.id }, select: { tokenHash: true } });
    expect(storedTokens.every(({ tokenHash }) => /^[a-f0-9]{64}$/.test(tokenHash))).toBe(true);
    expect(storedTokens.some(({ tokenHash }) => tokenHash === extraRawToken)).toBe(false);

    const changed = await agent.post("/api/auth/change-password").set("Origin", origin)
      .send({ currentPassword: password, newPassword: "Changed-Lab3-Password!" });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(extraRawToken) } })).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects expired and inactive session users without revealing their identity", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Inactive Integration User", email: "inactive.integration@toktickit.test",
        passwordHash: await hashPassword(password), mustChangePassword: false, isActive: false,
      },
    });
    const inactiveToken = "inactive-session-token";
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(inactiveToken), expiresAt: sessionExpiry() } });
    const expiredToken = "expired-session-token";
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(expiredToken), expiresAt: new Date(0) } });

    for (const token of [inactiveToken, expiredToken]) {
      const response = await request(app).get("/api/auth/me").set("Cookie", `toktickit_session=${token}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Authentication is required.", code: "UNAUTHENTICATED" });
      expect(response.body).not.toHaveProperty("user");
    }
  });
});
