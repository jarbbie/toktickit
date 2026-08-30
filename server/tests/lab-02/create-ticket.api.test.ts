import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  requester: { findFirst: vi.fn() },
  category: { findFirst: vi.fn() },
  relatedSystem: { findFirst: vi.fn() },
  ticket: { create: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const validTicket = {
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 3,
  summary: "  VPN cannot connect  ",
  description: "  The VPN fails after entering my university credentials.  ",
};

function mockActiveReferences() {
  prisma.requester.findFirst.mockResolvedValue({ id: 1 });
  prisma.category.findFirst.mockResolvedValue({ id: 2 });
  prisma.relatedSystem.findFirst.mockResolvedValue({ id: 3 });
}

describe("POST /api/tickets", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a trimmed New ticket with a backend ticket number and default priority", async () => {
    mockActiveReferences();
    prisma.ticket.create.mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-A1B2C3D4", requesterId: 1, categoryId: 2, relatedSystemId: 3,
      requestedPriority: "MEDIUM", status: "NEW", summary: "VPN cannot connect",
      description: "The VPN fails after entering my university credentials.",
    });

    const response = await request(app).post("/api/tickets").send(validTicket);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ticketNumber: "TKT-2026-A1B2C3D4", requesterId: 1, status: "NEW", requestedPriority: "MEDIUM" });
    expect(prisma.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      requesterId: 1, categoryId: 2, relatedSystemId: 3, summary: "VPN cannot connect",
      description: "The VPN fails after entering my university credentials.", requestedPriority: "MEDIUM", status: "NEW",
    }) }));
  });

  it.each([
    ["requesterId", { requesterId: 0 }, "requesterId must be a positive integer."],
    ["categoryId", { categoryId: 0 }, "categoryId must be a positive integer."],
    ["relatedSystemId", { relatedSystemId: 0 }, "relatedSystemId must be a positive integer."],
    ["summary", { summary: "bad" }, "summary must be between 5 and 200 characters."],
    ["description", { description: "bad" }, "description must be between 10 and 4000 characters."],
    ["requestedPriority", { requestedPriority: "NOW" }, "requestedPriority must be LOW, MEDIUM, HIGH, or URGENT."],
  ])("rejects invalid %s without storing a ticket", async (_field, invalidValue, error) => {
    const response = await request(app).post("/api/tickets").send({ ...validTicket, ...invalidValue });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects inactive or missing references without storing a ticket", async () => {
    prisma.requester.findFirst.mockResolvedValue(null);
    prisma.category.findFirst.mockResolvedValue({ id: 2 });
    prisma.relatedSystem.findFirst.mockResolvedValue({ id: 3 });

    const response = await request(app).post("/api/tickets").send(validTicket);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Requester or reference data is unavailable." });
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("returns a safe JSON error for malformed JSON", async () => {
    const response = await request(app).post("/api/tickets").set("Content-Type", "application/json").send('{');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Malformed JSON request body." });
  });

  it("retries a duplicate ticket number", async () => {
    mockActiveReferences();
    prisma.ticket.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", status: "NEW" });

    const response = await request(app).post("/api/tickets").send(validTicket);

    expect(response.status).toBe(201);
    expect(prisma.ticket.create).toHaveBeenCalledTimes(2);
  });
});
