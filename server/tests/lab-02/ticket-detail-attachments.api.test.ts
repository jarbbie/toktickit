import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const storage = vi.hoisted(() => ({ attachmentPath: vi.fn((key: string) => `/uploads/${key}`), discardAttachment: vi.fn(), saveAttachment: vi.fn() }));
const prisma = vi.hoisted(() => ({
  requester: { findFirst: vi.fn() },
  ticket: { findFirst: vi.fn() },
  attachment: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));
vi.mock("../../src/attachment-storage.js", () => storage);

import { app } from "../../src/app.js";

const attachment = { id: 4, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 3, createdAt: new Date(), removedAt: null, removalReason: null };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.requester.findFirst.mockResolvedValue({ id: 1 });
});

describe("requester ticket detail and attachments", () => {
  it("returns an owned ticket detail and hides an unowned ticket", async () => {
    prisma.ticket.findFirst.mockResolvedValueOnce({ id: 1, ticketNumber: "TKT-2026-A1B2C3D4", summary: "VPN cannot connect", description: "The VPN fails after login.", requestedPriority: "MEDIUM", status: "NEW", category: { id: 2, name: "Hardware" }, relatedSystem: { id: 3, name: "VPN" }, attachments: [attachment] }).mockResolvedValueOnce(null);

    const owned = await request(app).get("/api/tickets/1?requesterId=1");
    const unowned = await request(app).get("/api/tickets/2?requesterId=1");

    expect(owned.status).toBe(200);
    expect(owned.body.attachments[0]).toMatchObject({ originalName: "vpn.pdf" });
    expect(unowned.status).toBe(404);
  });

  it("uploads a permitted owned attachment and rejects an unsupported type", async () => {
    prisma.ticket.findFirst.mockResolvedValue({ id: 1 });
    prisma.attachment.count.mockResolvedValue(0);
    prisma.attachment.create.mockResolvedValue(attachment);

    const created = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.from("pdf"), { filename: "vpn.pdf", contentType: "application/pdf" });
    const rejected = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.from("text"), { filename: "note.txt", contentType: "text/plain" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ originalName: "vpn.pdf" });
    expect(storage.saveAttachment).toHaveBeenCalled();
    expect(rejected.status).toBe(415);
  });

  it("returns attachment metadata only for its owner", async () => {
    prisma.attachment.findFirst.mockResolvedValueOnce(attachment).mockResolvedValueOnce(null);

    const owned = await request(app).get("/api/attachments/4?requesterId=1");
    const unowned = await request(app).get("/api/attachments/5?requesterId=1");

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({ originalName: "vpn.pdf" });
    expect(unowned.status).toBe(404);
  });

  it("rejects an oversized or sixth attachment and blocks removed downloads", async () => {
    const oversized = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "large.pdf", contentType: "application/pdf" });
    prisma.ticket.findFirst.mockResolvedValue({ id: 1 });
    prisma.attachment.count.mockResolvedValue(5);
    const sixth = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.from("pdf"), { filename: "sixth.pdf", contentType: "application/pdf" });
    prisma.attachment.findFirst.mockResolvedValue(null);
    const removedDownload = await request(app).get("/api/attachments/4/download?requesterId=1");

    expect(oversized.status).toBe(413);
    expect(sixth.status).toBe(409);
    expect(removedDownload.status).toBe(404);
  });

  it("soft-removes an owned active attachment and returns 404 for an unowned one", async () => {
    prisma.attachment.findFirst.mockResolvedValueOnce({ id: 4 }).mockResolvedValueOnce(null);
    prisma.attachment.update.mockResolvedValue({ ...attachment, removedAt: new Date(), removalReason: "Wrong file" });

    const removed = await request(app).delete("/api/attachments/4").send({ requesterId: 1, reason: "Wrong file" });
    const unowned = await request(app).delete("/api/attachments/5").send({ requesterId: 1, reason: "Wrong file" });

    expect(removed.status).toBe(200);
    expect(removed.body.removalReason).toBe("Wrong file");
    expect(unowned.status).toBe(404);
  });
});
