import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({ ticket: { count: vi.fn(), findMany: vi.fn() } }));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

describe("GET /api/tickets", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns only the requester’s filtered, paginated tickets", async () => {
    prisma.ticket.count.mockResolvedValue(6);
    prisma.ticket.findMany.mockResolvedValue([{ id: 7, ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", requestedPriority: "HIGH", status: "NEW", category: { id: 2, name: "Hardware" }, updatedAt: new Date("2026-08-25T00:00:00.000Z") }]);

    const response = await request(app).get("/api/tickets?requesterId=1&search=vpn&categoryId=2&requestedPriority=HIGH&status=NEW&sortBy=ticketNumber&direction=asc&page=2&pageSize=5");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 2, pageSize: 5, totalItems: 6, totalPages: 2, items: [{ id: 7, ticketNumber: "TKT-2026-A1B2C3D4", category: { name: "Hardware" } }] });
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1, categoryId: 2, requestedPriority: "HIGH", status: "NEW" }),
      orderBy: { ticketNumber: "asc" }, skip: 5, take: 5,
    }));
  });

  it.each(["", "?requesterId=1&page=0", "?requesterId=1&pageSize=7", "?requesterId=1&sortBy=summary"])("returns a safe 400 for invalid query values: %s", async (query) => {
    const response = await request(app).get(`/api/tickets${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns a safe error when ticket loading fails", async () => {
    prisma.ticket.count.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/tickets?requesterId=1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unable to load tickets." });
  });
});
