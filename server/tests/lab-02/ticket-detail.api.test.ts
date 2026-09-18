import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

beforeEach(() => {
  vi.resetAllMocks();
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: { id: 1, name: "Nicha", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } });
});

describe("requester ticket detail", () => {
  it("returns an owned ticket detail and hides an unowned ticket", async () => {
    prisma.ticket.findFirst
      .mockResolvedValueOnce({
        id: 1,
        ticketNumber: "TKT-2026-A1B2C3D4",
        summary: "VPN cannot connect",
        description: "The VPN fails after login.",
        requestedPriority: "MEDIUM",
        status: "NEW",
        category: { id: 2, name: "Hardware" },
        relatedSystem: { id: 3, name: "VPN" },
        attachments: [],
      })
      .mockResolvedValueOnce(null);

    const owned = await request(app).get("/api/tickets/1").set("Cookie", "toktickit_session=token");
    const unowned = await request(app).get("/api/tickets/2").set("Cookie", "toktickit_session=token");

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({ ticketNumber: "TKT-2026-A1B2C3D4" });
    expect(unowned.status).toBe(404);
    expect(unowned.body.code).toBe("NOT_FOUND");
  });
});
