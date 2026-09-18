import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const transaction = vi.hoisted(() => ({
  ticket: { findMany: vi.fn(), count: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: true, mustChangePassword: false } as const;
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } as const;
const administrator = { id: 9, name: "Admin One", email: "admin@toktickit.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } as const;

const rows = [
  {
    id: 3, ticketNumber: "TKT-2026-C", summary: "Cannot connect to VPN", requestedPriority: "HIGH", itPriority: "URGENT", status: "OPEN",
    ownerId: 7, resolutionIndicatedAt: null, createdAt: new Date("2026-08-03T00:00:00.000Z"), updatedAt: new Date("2026-08-04T00:00:00.000Z"),
    category: { id: 2, name: "Hardware" }, requester: { id: 1, name: "Nicha Somchai" }, owner: { id: 7, name: "Support One", role: "IT_STAFF" },
  },
  {
    id: 2, ticketNumber: "TKT-2026-B", summary: "Email is slow", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "NEW",
    ownerId: null, resolutionIndicatedAt: null, createdAt: new Date("2026-08-02T00:00:00.000Z"), updatedAt: new Date("2026-08-05T00:00:00.000Z"),
    category: { id: 3, name: "Software" }, requester: { id: 2, name: "Mali Charoen" }, owner: null,
  },
  {
    id: 1, ticketNumber: "TKT-2026-A", summary: "Printer offline", requestedPriority: "LOW", itPriority: "LOW", status: "RESOLVED",
    ownerId: 8, resolutionIndicatedAt: null, createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    category: { id: 2, name: "Hardware" }, requester: { id: 3, name: "Anan Kittisak" }, owner: { id: 8, name: "Support Two", role: "IT_STAFF" },
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: staff });
  transaction.ticket.findMany.mockResolvedValue(rows);
  transaction.ticket.count.mockResolvedValue(rows.length);
});

describe("GET /api/staff/tickets", () => {
  it("returns a stable filtered page for IT Staff with queue fields", async () => {
    const response = await request(app).get("/api/staff/tickets?search=nicha&categoryId=2&requestedPriority=HIGH&itPriority=URGENT&status=OPEN&ownership=mine&sortBy=itPriority&direction=desc&page=1&pageSize=10").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({ page: 1, pageSize: 10, totalItems: 3, totalPages: 1 });
    expect(response.body.items[0]).toMatchObject({ ticketNumber: "TKT-2026-C", requester: { name: "Nicha Somchai" }, owner: { name: "Support One" }, itPriority: "URGENT" });
    expect(response.body.items[0]).toHaveProperty("resolutionIndicatedAt", null);
    expect(transaction.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryId: 2, requestedPriority: "HIGH", itPriority: "URGENT", status: "OPEN", ownerId: 7, OR: expect.any(Array) }),
      orderBy: { id: "asc" },
    }));
    expect(transaction.ticket.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: 7 }) }));
  });

  it("sorts priority values semantically and applies one-based pagination", async () => {
    transaction.ticket.findMany.mockResolvedValue([
      ...rows,
      ...Array.from({ length: 8 }, (_, index) => ({ ...rows[0], id: 10 + index, ticketNumber: `TKT-2026-U${index}`, requestedPriority: "URGENT" as const })),
    ]);
    transaction.ticket.count.mockResolvedValue(11);

    const response = await request(app).get("/api/staff/tickets?sortBy=requestedPriority&direction=asc&page=2&pageSize=10").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 2, pageSize: 10, totalItems: 11, totalPages: 2 });
    expect(response.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual(["TKT-2026-U7"]);
  });

  it("allows Administrators to use the same queue", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: administrator });

    const response = await request(app).get("/api/staff/tickets").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
  });

  it.each(["?pageSize=5", "?sortBy=summary", "?ownership=other", "?status=NEW&status=OPEN", "?requesterId=1"])('%s returns a safe 400 without querying tickets', async (query) => {
    const response = await request(app).get(`/api/staff/tickets${query}`).set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(transaction.ticket.findMany).not.toHaveBeenCalled();
  });

  it("rejects Requesters before looking up queue data", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });

    const response = await request(app).get("/api/staff/tickets").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Access denied.", code: "FORBIDDEN" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns a safe error when the queue cannot be loaded", async () => {
    transaction.ticket.findMany.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/staff/tickets").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unable to load staff tickets." });
  });
});
