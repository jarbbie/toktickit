import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const transaction = vi.hoisted(() => ({
  ticket: { findFirst: vi.fn(), update: vi.fn() },
  publicComment: { create: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn() },
  publicComment: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

const origin = "http://localhost:5173";
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } as const;
const cookie = "toktickit_session=requester-token";
const comment = { id: 8, ticketId: 4, content: "The connection works now.", createdAt: new Date("2026-09-18T10:00:00.000Z"), author: { id: 1, name: "Nicha Somchai" } };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: requester });
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
});

describe("authenticated requester regression", () => {
  it("rejects obsolete identity inputs and hides the removed requester endpoint", async () => {
    const list = await request(app).get("/api/tickets?requesterId=2").set("Cookie", cookie);
    const detail = await request(app).get("/api/tickets/4?requesterId=2").set("Cookie", cookie);
    const requesters = await request(app).get("/api/requesters");

    expect(list.status).toBe(400);
    expect(detail.status).toBe(400);
    expect(requesters.status).toBe(404);
    expect(requesters.body).toEqual({ error: "Not found.", code: "NOT_FOUND" });
  });

  it("returns owned public comments with backend author and chronological ordering", async () => {
    prisma.ticket.findFirst.mockResolvedValueOnce({ id: 4 }).mockResolvedValueOnce(null);
    prisma.publicComment.findMany.mockResolvedValue([comment]);

    const owned = await request(app).get("/api/tickets/4/public-comments").set("Cookie", cookie);
    const foreign = await request(app).get("/api/tickets/9/public-comments").set("Cookie", cookie);

    expect(owned.status).toBe(200);
    expect(owned.body).toEqual([{ id: 8, ticketId: 4, body: comment.content, author: comment.author, createdAt: comment.createdAt.toISOString() }]);
    expect(prisma.publicComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: 4 }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "Ticket not found.", code: "NOT_FOUND" });
  });

  it("creates a trimmed public comment using the authenticated author", async () => {
    transaction.ticket.findFirst.mockResolvedValue({ id: 4 });
    transaction.publicComment.create.mockResolvedValue(comment);
    transaction.ticket.update.mockResolvedValue({ id: 4 });

    const response = await request(app).post("/api/tickets/4/public-comments")
      .set("Origin", origin).set("Cookie", cookie).send({ body: "  The connection works now.  " });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 8, ticketId: 4, body: "The connection works now.", author: { id: requester.id, name: requester.name } });
    expect(transaction.publicComment.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketId: 4, authorId: 1, content: "The connection works now." } }));
    expect(transaction.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4 }, data: expect.objectContaining({ updatedAt: expect.any(Date) }) }));
  });

  it("rejects empty, oversized, and forged comment fields without writing", async () => {
    const empty = await request(app).post("/api/tickets/4/public-comments").set("Origin", origin).set("Cookie", cookie).send({ body: "   " });
    const oversized = await request(app).post("/api/tickets/4/public-comments").set("Origin", origin).set("Cookie", cookie).send({ body: "x".repeat(2001) });
    const forged = await request(app).post("/api/tickets/4/public-comments").set("Origin", origin).set("Cookie", cookie).send({ body: "valid", authorId: 9 });

    expect(empty.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(forged.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records resolution indication once, preserves its first timestamp, and leaves status unchanged", async () => {
    const first = { id: 4, status: "IN_PROGRESS", resolutionIndicatedAt: null, updatedAt: new Date("2026-09-18T09:00:00.000Z") };
    const indicatedAt = new Date("2026-09-18T10:00:00.000Z");
    transaction.ticket.findFirst.mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, resolutionIndicatedAt: indicatedAt, updatedAt: new Date("2026-09-18T10:01:00.000Z") });
    transaction.ticket.update.mockResolvedValue({ id: 4, status: "IN_PROGRESS", resolutionIndicatedAt: indicatedAt, updatedAt: indicatedAt });

    const created = await request(app).post("/api/tickets/4/resolution-indication").set("Origin", origin).set("Cookie", cookie).send({});
    const repeated = await request(app).post("/api/tickets/4/resolution-indication").set("Origin", origin).set("Cookie", cookie).send({});

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ ticketId: 4, status: "IN_PROGRESS", resolutionIndicatedAt: indicatedAt.toISOString() });
    expect(repeated.status).toBe(200);
    expect(repeated.body.resolutionIndicatedAt).toBe(indicatedAt.toISOString());
    expect(transaction.ticket.update).toHaveBeenCalledTimes(1);
  });

  it("rejects resolution indication for terminal tickets", async () => {
    transaction.ticket.findFirst.mockResolvedValue({ id: 4, status: "RESOLVED", resolutionIndicatedAt: null, updatedAt: new Date() });

    const response = await request(app).post("/api/tickets/4/resolution-indication").set("Origin", origin).set("Cookie", cookie).send({});

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CONFLICT");
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });
});
