import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { writeFile } from "node:fs/promises";

const storage = vi.hoisted(() => ({
  attachmentPath: vi.fn(() => "/tmp/toktickit-staff-ticket-download.pdf"),
  discardAttachment: vi.fn(),
  saveAttachment: vi.fn(),
}));

const transaction = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  ticket: { findFirst: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  internalNote: { findMany: vi.fn(), create: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  attachment: { findFirst: vi.fn() },
  internalNote: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));
vi.mock("../../src/attachment-storage.js", () => storage);

import { app } from "../../src/app.js";

const origin = "http://localhost:5173";
const cookie = "toktickit_session=staff-token";
const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: true, mustChangePassword: false } as const;
const administrator = { id: 9, name: "Admin One", email: "admin@toktickit.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } as const;
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } as const;
const ownerOptions = [{ id: 7, name: "Support One", role: "IT_STAFF" }, { id: 9, name: "Admin One", role: "ADMINISTRATOR" }];
const detail = {
  id: 4,
  ticketNumber: "TKT-2026-A1B2C3D4",
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 3,
  summary: "VPN cannot connect",
  description: "The VPN fails immediately after sign-in.",
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  status: "OPEN",
  ownerId: 7,
  resolutionIndicatedAt: null,
  createdAt: new Date("2026-09-18T09:00:00.000Z"),
  updatedAt: new Date("2026-09-18T10:00:00.000Z"),
  requester: { id: 1, name: "Nicha Somchai" },
  owner: { id: 7, name: "Support One", role: "IT_STAFF" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 3, name: "VPN" },
  attachments: [{ id: 11, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 8, createdAt: new Date("2026-09-18T08:00:00.000Z"), removedAt: null, removalReason: null }],
};

beforeEach(() => {
  vi.resetAllMocks();
  storage.attachmentPath.mockReturnValue("/tmp/toktickit-staff-ticket-download.pdf");
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: staff });
  prisma.ticket.findFirst.mockResolvedValue(detail);
  prisma.user.findMany.mockResolvedValue(ownerOptions);
  prisma.attachment.findFirst.mockResolvedValue({ id: 11, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 8, createdAt: new Date("2026-09-18T08:00:00.000Z"), removedAt: null, removalReason: null, storageKey: "staff-download" });
  prisma.internalNote.findMany.mockResolvedValue([]);
  transaction.$executeRaw.mockResolvedValue(1);
  transaction.ticket.findFirst.mockResolvedValue({ id: 4, ownerId: 7, status: "OPEN", itPriority: "HIGH" });
  transaction.ticket.update.mockResolvedValue({ id: 4 });
  transaction.user.findFirst.mockResolvedValue({ id: 7 });
  transaction.user.findMany.mockResolvedValue(ownerOptions);
  transaction.internalNote.findMany.mockResolvedValue([]);
  transaction.internalNote.create.mockResolvedValue({ id: 21, ticketId: 4, content: "Checked the VPN logs.", createdAt: new Date("2026-09-18T11:00:00.000Z"), author: { id: 7, name: "Support One" } });
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
});

describe("IT Staff Ticket operations", () => {
  it("returns the complete staff detail and eligible owner options", async () => {
    const response = await request(app).get("/api/staff/tickets/4").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({ ticketNumber: detail.ticketNumber, requesterId: 1, requestedPriority: "MEDIUM", itPriority: "HIGH", ownerId: 7, status: "OPEN" });
    expect(response.body.ownerOptions).toEqual(expect.arrayContaining([{ id: 7, name: "Support One", role: "IT_STAFF" }, { id: 9, name: "Admin One", role: "ADMINISTRATOR" }]));
    expect(response.body.attachments[0]).toMatchObject({ originalName: "vpn.pdf", removedAt: null });
  });

  it("allows staff to read attachment metadata and download an active file", async () => {
    await writeFile("/tmp/toktickit-staff-ticket-download.pdf", "%PDF-1.4\n");

    const metadata = await request(app).get("/api/attachments/11").set("Cookie", cookie);
    const download = await request(app).get("/api/attachments/11/download").set("Cookie", cookie);

    expect(metadata.status).toBe(200);
    expect(metadata.body).toMatchObject({ id: 11, originalName: "vpn.pdf", removedAt: null });
    expect(download.status).toBe(200);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(download.headers["content-disposition"]).toContain("vpn.pdf");
    expect(download.body.toString()).toContain("%PDF-1.4");
  });

  it("rejects Requesters before looking up a staff ticket", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });

    const response = await request(app).get("/api/staff/tickets/4").set("Cookie", "toktickit_session=requester-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Access denied.", code: "FORBIDDEN" });
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("claims an unassigned ticket without changing its status", async () => {
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, ownerId: null }).mockResolvedValueOnce({ ...detail, ownerId: 7 });

    const response = await request(app).post("/api/staff/tickets/4/claim").set("Origin", origin).set("Cookie", cookie).send({});

    expect(response.status).toBe(200);
    expect(transaction.$executeRaw.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock");
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4 }, data: expect.objectContaining({ ownerId: 7, updatedAt: expect.any(Date) }) }));
    expect(response.body.status).toBe("OPEN");
  });

  it("returns a conflict for an already assigned or repeated claim", async () => {
    transaction.ticket.findFirst.mockResolvedValue({ id: 4, ownerId: 8 });

    const response = await request(app).post("/api/staff/tickets/4/claim").set("Origin", origin).set("Cookie", cookie).send({});

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "This ticket is already assigned.", code: "TICKET_ALREADY_ASSIGNED" });
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });

  it("assigns, unassigns, and validates only active staff/admin owners", async () => {
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, ownerId: 7 }).mockResolvedValueOnce({ ...detail, ownerId: 9 });
    transaction.user.findFirst.mockResolvedValue({ id: 9 });

    const assigned = await request(app).patch("/api/staff/tickets/4/owner").set("Origin", origin).set("Cookie", cookie).send({ ownerId: 9 });
    expect(assigned.status).toBe(200);
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: 9 }) }));

    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, ownerId: 9 }).mockResolvedValueOnce({ ...detail, ownerId: null, owner: null });
    const unassigned = await request(app).patch("/api/staff/tickets/4/owner").set("Origin", origin).set("Cookie", cookie).send({ ownerId: null });
    expect(unassigned.status).toBe(200);
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: null }) }));

    transaction.ticket.findFirst.mockResolvedValue({ id: 4, ownerId: null });
    transaction.user.findFirst.mockResolvedValue(null);
    const invalidOwner = await request(app).patch("/api/staff/tickets/4/owner").set("Origin", origin).set("Cookie", cookie).send({ ownerId: 88 });
    expect(invalidOwner.status).toBe(409);
    expect(invalidOwner.body.code).toBe("OWNER_UNAVAILABLE");
  });

  it("changes only IT Priority and makes the same value idempotent", async () => {
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, itPriority: "MEDIUM" }).mockResolvedValueOnce({ ...detail, itPriority: "URGENT" });

    const changed = await request(app).patch("/api/staff/tickets/4/it-priority").set("Origin", origin).set("Cookie", cookie).send({ itPriority: "URGENT" });
    expect(changed.status).toBe(200);
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ itPriority: "URGENT" }) }));

    transaction.ticket.update.mockClear();
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, itPriority: "URGENT" }).mockResolvedValueOnce({ ...detail, itPriority: "URGENT" });
    const repeated = await request(app).patch("/api/staff/tickets/4/it-priority").set("Origin", origin).set("Cookie", cookie).send({ itPriority: "URGENT" });
    expect(repeated.status).toBe(200);
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });

  it("enforces the status matrix and clears resolution indication on Reopened", async () => {
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 4, status: "RESOLVED" }).mockResolvedValueOnce({ ...detail, status: "REOPENED", resolutionIndicatedAt: null });

    const reopened = await request(app).patch("/api/staff/tickets/4/status").set("Origin", origin).set("Cookie", cookie).send({ status: "REOPENED" });
    expect(reopened.status).toBe(200);
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REOPENED", resolutionIndicatedAt: null }) }));

    transaction.ticket.findFirst.mockResolvedValue({ id: 4, status: "CANCELLED" });
    const invalid = await request(app).patch("/api/staff/tickets/4/status").set("Origin", origin).set("Cookie", cookie).send({ status: "OPEN" });
    expect(invalid.status).toBe(409);
    expect(invalid.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("retrieves internal notes in chronological order and never exposes them to Requesters", async () => {
    const note = { id: 21, ticketId: 4, content: "Checked the VPN logs.", createdAt: new Date("2026-09-18T11:00:00.000Z"), author: { id: 7, name: "Support One" } };
    prisma.internalNote.findMany.mockResolvedValue([note]);

    const notes = await request(app).get("/api/staff/tickets/4/internal-notes").set("Cookie", cookie);
    expect(notes.status).toBe(200);
    expect(notes.body).toEqual([{ id: 21, ticketId: 4, body: note.content, author: note.author, createdAt: note.createdAt.toISOString() }]);
    expect(prisma.internalNote.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));

    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });
    const forbidden = await request(app).get("/api/staff/tickets/4/internal-notes").set("Cookie", "toktickit_session=requester-token");
    expect(forbidden.status).toBe(403);
    expect(prisma.internalNote.findMany).toHaveBeenCalledTimes(1);
  });

  it("creates a trimmed backend-authored Internal Note and updates the ticket atomically", async () => {
    transaction.ticket.findFirst.mockResolvedValue({ id: 4 });

    const response = await request(app).post("/api/staff/tickets/4/internal-notes").set("Origin", origin).set("Cookie", cookie).send({ body: "  Checked the VPN logs.  " });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 21, ticketId: 4, body: "Checked the VPN logs.", author: { id: 7, name: "Support One" } });
    expect(transaction.internalNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketId: 4, authorId: 7, content: "Checked the VPN logs." } }));
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4 }, data: expect.objectContaining({ updatedAt: expect.any(Date) }) }));

    const invalid = await request(app).post("/api/staff/tickets/4/internal-notes").set("Origin", origin).set("Cookie", cookie).send({ body: "   " });
    expect(invalid.status).toBe(400);
  });

  it("returns safe validation errors without mutating on malformed operations", async () => {
    const owner = await request(app).patch("/api/staff/tickets/4/owner").set("Origin", origin).set("Cookie", cookie).send({ ownerId: "7" });
    const priority = await request(app).patch("/api/staff/tickets/4/it-priority").set("Origin", origin).set("Cookie", cookie).send({ itPriority: "P0" });
    const status = await request(app).patch("/api/staff/tickets/4/status").set("Origin", origin).set("Cookie", cookie).send({ status: "DONE" });

    expect(owner.status).toBe(400);
    expect(priority.status).toBe(400);
    expect(status.status).toBe(400);
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });
});
