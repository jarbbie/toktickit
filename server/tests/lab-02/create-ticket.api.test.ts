import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  category: { findFirst: vi.fn() },
  relatedSystem: { findFirst: vi.fn() },
  ticket: { create: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const validTicket = {
  categoryId: 2,
  relatedSystemId: 3,
  summary: "  VPN cannot connect  ",
  description: "  The VPN fails after entering my university credentials.  ",
};

function mockActiveReferences() {
  prisma.category.findFirst.mockResolvedValue({ id: 2 });
  prisma.relatedSystem.findFirst.mockResolvedValue({ id: 3 });
}

function postTicket(body = validTicket) {
  return request(app).post("/api/tickets").set("Origin", "http://localhost:5173").set("Cookie", "toktickit_session=token").send(body);
}

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: { id: 1, name: "Nicha", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } });
  });

  it("creates a trimmed New ticket with a backend ticket number and default priority", async () => {
    mockActiveReferences();
    prisma.ticket.create.mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-A1B2C3D4", requesterId: 1, categoryId: 2, relatedSystemId: 3,
      requestedPriority: "MEDIUM", status: "NEW", summary: "VPN cannot connect",
      description: "The VPN fails after entering my university credentials.",
    });

    const response = await postTicket();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ticketNumber: "TKT-2026-A1B2C3D4", requesterId: 1, status: "NEW", requestedPriority: "MEDIUM" });
    expect(prisma.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      requesterId: 1, categoryId: 2, relatedSystemId: 3, summary: "VPN cannot connect",
      description: "The VPN fails after entering my university credentials.", requestedPriority: "MEDIUM", status: "NEW",
    }) }));
  });

  it.each([
    ["requesterId", { requesterId: 0 }, "requesterId is not allowed."],
    ["categoryId", { categoryId: 0 }, "categoryId must be a positive integer."],
    ["relatedSystemId", { relatedSystemId: 0 }, "relatedSystemId must be a positive integer."],
    ["summary", { summary: "bad" }, "summary must be between 5 and 200 characters."],
    ["description", { description: "bad" }, "description must be between 10 and 4000 characters."],
    ["requestedPriority", { requestedPriority: "NOW" }, "requestedPriority must be LOW, MEDIUM, HIGH, or URGENT."],
  ])("rejects invalid %s without storing a ticket", async (_field, invalidValue, error) => {
    const response = await postTicket({ ...validTicket, ...invalidValue });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects inactive or missing references without storing a ticket", async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.relatedSystem.findFirst.mockResolvedValue({ id: 3 });

    const response = await postTicket();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Reference data is unavailable." });
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("returns a safe JSON error for malformed JSON", async () => {
    const response = await request(app).post("/api/tickets").set("Origin", "http://localhost:5173").set("Cookie", "toktickit_session=token").set("Content-Type", "application/json").send('{');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Malformed JSON request body." });
  });

  it("returns safe JSON for an oversized request body", async () => {
    const response = await request(app).post("/api/tickets").set("Origin", "http://localhost:5173").set("Cookie", "toktickit_session=token").send({ value: "a".repeat(110 * 1024) });

    expect(response.status).toBe(413);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({ error: "Request body exceeds the size limit." });
    expect(response.text).not.toContain(process.cwd());
  });

  it("retries a duplicate ticket number", async () => {
    mockActiveReferences();
    prisma.ticket.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", status: "NEW" });

    const response = await postTicket();

    expect(response.status).toBe(201);
    expect(prisma.ticket.create).toHaveBeenCalledTimes(2);
  });
});
