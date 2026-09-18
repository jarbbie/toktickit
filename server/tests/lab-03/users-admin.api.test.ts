import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const transaction = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  ticket: { count: vi.fn() },
  session: { deleteMany: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const origin = "http://localhost:5173";
const cookie = "toktickit_session=admin-token";
const administrator = { id: 9, name: "Lab Administrator", email: "admin@toktickit.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } as const;
const requester = { id: 1, name: "Nicha Somchai", email: "nicha.somchai@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } as const;
const userRecord = {
  id: 7,
  name: "Support One",
  email: "support.one@toktickit.test",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date("2026-09-18T08:00:00.000Z"),
  updatedAt: new Date("2026-09-18T08:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: administrator });
  prisma.user.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
  transaction.$executeRaw.mockResolvedValue(1);
  transaction.user.findUnique.mockResolvedValue(userRecord);
  transaction.user.create.mockResolvedValue(userRecord);
  transaction.user.update.mockResolvedValue(userRecord);
  transaction.user.count.mockResolvedValue(2);
  transaction.ticket.count.mockResolvedValue(0);
  transaction.session.deleteMany.mockResolvedValue({ count: 0 });
});

describe("Administrator User Management API", () => {
  it("lists all users with normalized search, one role filter, and safe fields", async () => {
    prisma.user.findMany.mockResolvedValue([userRecord]);

    const response = await request(app)
      .get("/api/admin/users?search=%20SUPPORT&role=IT_STAFF")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual([{ ...userRecord, createdAt: userRecord.createdAt.toISOString(), updatedAt: userRecord.updatedAt.toISOString() }]);
    expect(response.body[0]).not.toHaveProperty("passwordHash");
    expect(response.body[0]).not.toHaveProperty("sessions");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: "IT_STAFF", OR: [{ name: { contains: "SUPPORT", mode: "insensitive" } }, { email: { contains: "SUPPORT", mode: "insensitive" } }] },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }));
  });

  it("blocks non-Administrators before querying users", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });

    const response = await request(app).get("/api/admin/users").set("Cookie", "toktickit_session=requester-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Access denied.", code: "FORBIDDEN" });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("blocks non-Administrators from every user-management mutation", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });

    const create = await request(app).post("/api/admin/users").set("Origin", origin).set("Cookie", "toktickit_session=requester-token").send({ name: "Blocked", email: "blocked@toktickit.test", role: "REQUESTER", isActive: true, initialPassword: "Lab3-Initial-2026!" });
    const update = await request(app).patch("/api/admin/users/7").set("Origin", origin).set("Cookie", "toktickit_session=requester-token").send({ name: "Blocked" });
    const reset = await request(app).post("/api/admin/users/7/initial-password").set("Origin", origin).set("Cookie", "toktickit_session=requester-token").send({ initialPassword: "Replacement-Lab3-Pass!" });

    expect([create, update, reset].map((response) => response.status)).toEqual([403, 403, 403]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["?role=OTHER", "?role=IT_STAFF&role=REQUESTER", "?unknown=value", `?search=${"x".repeat(201)}`])("rejects invalid list query %s safely", async (query) => {
    const response = await request(app).get(`/api/admin/users${query}`).set("Cookie", cookie);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("creates a normalized user with a hashed initial password and required change", async () => {
    transaction.user.findUnique.mockResolvedValue(null);
    transaction.user.create.mockResolvedValue(userRecord);

    const response = await request(app).post("/api/admin/users").set("Origin", origin).set("Cookie", cookie).send({
      name: "  Support One  ",
      email: " SUPPORT.ONE@TOKTICKIT.TEST ",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "Lab3-Initial-2026!",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 7, role: "IT_STAFF" });
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(transaction.$executeRaw.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock");
    expect(transaction.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: true, mustChangePassword: true, passwordHash: expect.stringMatching(/^\$argon2id\$/) }),
    }));
  });

  it("rejects duplicate email without creating a user", async () => {
    transaction.user.findUnique.mockResolvedValue({ id: 12 });

    const response = await request(app).post("/api/admin/users").set("Origin", origin).set("Cookie", cookie).send({
      name: "Duplicate",
      email: " SUPPORT.ONE@TOKTICKIT.TEST ",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "Lab3-Initial-2026!",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Email is already in use.", code: "EMAIL_IN_USE", fieldErrors: { email: "Email is already in use." } });
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it("validates creation fields and rejects unknown or multiple roles", async () => {
    const invalid = await request(app).post("/api/admin/users").set("Origin", origin).set("Cookie", cookie).send({
      name: "A",
      email: "not-an-email",
      role: ["REQUESTER", "IT_STAFF"],
      isActive: "yes",
      initialPassword: "short",
      passwordHash: "must-not-be-accepted",
    });

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it("updates account fields and revokes sessions after a role or activation change", async () => {
    transaction.user.findUnique.mockResolvedValue({ ...userRecord, role: "IT_STAFF", isActive: true });

    const response = await request(app).patch("/api/admin/users/7").set("Origin", origin).set("Cookie", cookie).send({
      name: "  Support Renamed  ",
      email: " SUPPORT.RENAMED@TOKTICKIT.TEST ",
      role: "REQUESTER",
      isActive: false,
    });

    expect(response.status).toBe(200);
    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "Support Renamed", email: "support.renamed@toktickit.test", role: "REQUESTER", isActive: false } }));
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
  });

  it("enforces self, last-administrator, and assigned-owner safety rules", async () => {
    transaction.user.findUnique.mockResolvedValueOnce({ ...userRecord, id: 9, role: "ADMINISTRATOR", isActive: true });
    const self = await request(app).patch("/api/admin/users/9").set("Origin", origin).set("Cookie", cookie).send({ isActive: false });
    expect(self.status).toBe(409);
    expect(self.body.code).toBe("SELF_DEACTIVATION");

    transaction.user.findUnique.mockResolvedValueOnce({ ...userRecord, id: 8, role: "ADMINISTRATOR", isActive: true });
    transaction.user.count.mockResolvedValueOnce(1);
    const last = await request(app).patch("/api/admin/users/8").set("Origin", origin).set("Cookie", cookie).send({ role: "IT_STAFF" });
    expect(last.status).toBe(409);
    expect(last.body.code).toBe("LAST_ACTIVE_ADMINISTRATOR");

    transaction.user.findUnique.mockResolvedValueOnce(userRecord);
    transaction.user.count.mockResolvedValueOnce(2);
    transaction.ticket.count.mockResolvedValueOnce(1);
    const owner = await request(app).patch("/api/admin/users/7").set("Origin", origin).set("Cookie", cookie).send({ isActive: false });
    expect(owner.status).toBe(409);
    expect(owner.body.code).toBe("ASSIGNED_TICKET_OWNER");
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it("resets an initial password, requires change, and revokes target sessions", async () => {
    transaction.user.findUnique.mockResolvedValue({ ...userRecord, passwordHash: null });
    transaction.user.update.mockResolvedValue({ ...userRecord, mustChangePassword: true });

    const response = await request(app).post("/api/admin/users/7/initial-password").set("Origin", origin).set("Cookie", cookie).send({ initialPassword: "Replacement-Lab3-Pass!" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 7, mustChangePassword: true });
    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { passwordHash: expect.stringMatching(/^\$argon2id\$/), mustChangePassword: true } }));
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
  });

  it("clears the current cookie when the Administrator resets their own password", async () => {
    transaction.user.findUnique.mockResolvedValue({ ...userRecord, id: 9, passwordHash: null });
    transaction.user.update.mockResolvedValue({ ...userRecord, id: 9, mustChangePassword: true });

    const response = await request(app).post("/api/admin/users/9/initial-password").set("Origin", origin).set("Cookie", cookie).send({ initialPassword: "Replacement-Lab3-Pass!" });

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.[0]).toContain("toktickit_session=");
    expect(response.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
  });
});
