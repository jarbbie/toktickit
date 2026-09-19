import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const transaction = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  ticket: { findFirst: vi.fn(), update: vi.fn() },
  publicComment: { create: vi.fn() },
  internalNote: { create: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn() },
  publicComment: { findMany: vi.fn() },
  internalNote: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const origin = "http://localhost:5173";
const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: true, mustChangePassword: false } as const;
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } as const;
const comment = { id: 8, ticketId: 4, content: "Checked the connection.", createdAt: new Date("2026-09-19T10:00:00.000Z"), author: { id: 7, name: "Support One" } };
const note = { id: 9, ticketId: 4, content: "Internal diagnostic note.", createdAt: new Date("2026-09-19T10:01:00.000Z"), author: { id: 7, name: "Support One" } };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: staff });
  prisma.ticket.findFirst.mockResolvedValue({ id: 4 });
  prisma.publicComment.findMany.mockResolvedValue([comment]);
  prisma.internalNote.findMany.mockResolvedValue([note]);
  transaction.$executeRaw.mockResolvedValue(1);
  transaction.ticket.findFirst.mockResolvedValue({ id: 4 });
  transaction.ticket.update.mockResolvedValue({ id: 4 });
  transaction.publicComment.create.mockResolvedValue(comment);
  transaction.internalNote.create.mockResolvedValue(note);
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
});

describe("Lab 3 Public Comments and Internal Notes", () => {
  it("returns Public Comments to staff with backend ordering and authorship", async () => {
    const response = await request(app).get("/api/tickets/4/public-comments").set("Cookie", "toktickit_session=staff-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 8, ticketId: 4, body: comment.content, author: comment.author, createdAt: comment.createdAt.toISOString() }]);
    expect(prisma.publicComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: 4 }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
  });

  it("keeps Internal Notes staff-only before looking up their contents", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });

    const response = await request(app).get("/api/staff/tickets/4/internal-notes").set("Cookie", "toktickit_session=requester-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Access denied.", code: "FORBIDDEN" });
    expect(prisma.internalNote.findMany).not.toHaveBeenCalled();
  });

  it("trims and persists a backend-authored Internal Note transactionally", async () => {
    const response = await request(app).post("/api/staff/tickets/4/internal-notes")
      .set("Origin", origin).set("Cookie", "toktickit_session=staff-token")
      .send({ body: "  Internal diagnostic note.  " });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 9, ticketId: 4, body: note.content, author: note.author });
    expect(transaction.internalNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketId: 4, authorId: 7, content: note.content } }));
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4 }, data: { updatedAt: expect.any(Date) } }));
  });
});
