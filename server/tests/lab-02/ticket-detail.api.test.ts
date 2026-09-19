import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  requester: { findFirst: vi.fn() },
  ticket: { findFirst: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

beforeEach(() => {
  vi.resetAllMocks();
  prisma.requester.findFirst.mockResolvedValue({ id: 1 });
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

    const owned = await request(app).get("/api/tickets/1?requesterId=1");
    const unowned = await request(app).get("/api/tickets/2?requesterId=1");

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({ ticketNumber: "TKT-2026-A1B2C3D4" });
    expect(unowned.status).toBe(404);
  });
});
