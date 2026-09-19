import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({ session: { findUnique: vi.fn() }, ticket: { count: vi.fn(), findMany: vi.fn() } }));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

describe("GET /api/tickets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: { id: 1, name: "Nicha", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } });
  });

  it("returns only the requester’s filtered, paginated tickets", async () => {
    prisma.ticket.count.mockResolvedValue(6);
    prisma.ticket.findMany.mockResolvedValue([{ id: 7, ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", requestedPriority: "HIGH", status: "NEW", category: { id: 2, name: "Hardware" }, createdAt: new Date("2026-08-24T00:00:00.000Z"), updatedAt: new Date("2026-08-25T00:00:00.000Z") }]);

    const response = await request(app).get("/api/tickets?search=vpn&categoryId=2&requestedPriority=HIGH&status=NEW&sortBy=ticketNumber&direction=asc&page=2&pageSize=5").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 2, pageSize: 5, totalItems: 6, totalPages: 2, items: [{ id: 7, ticketNumber: "TKT-2026-A1B2C3D4", category: { name: "Hardware" } }] });
    expect(response.body.items[0]).toHaveProperty("createdAt");
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1, categoryId: 2, requestedPriority: "HIGH", status: "NEW" }),
      orderBy: [{ ticketNumber: "asc" }, { id: "asc" }], skip: 5, take: 5,
    }));
  });

  it.each(["?requesterId=1", "?page=0", "?pageSize=7", "?sortBy=summary"])("returns a safe 400 for invalid query values: %s", async (query) => {
    const response = await request(app).get(`/api/tickets${query}`).set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns a safe error when ticket loading fails", async () => {
    prisma.ticket.count.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/tickets").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unable to load tickets." });
  });

  it("rejects a forged requester identity input", async () => {
    const response = await request(app).get("/api/tickets?requesterId=2").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "requesterId is not allowed." });
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });
});
