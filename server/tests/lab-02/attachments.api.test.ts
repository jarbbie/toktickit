import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const storage = vi.hoisted(() => ({ attachmentPath: vi.fn((key: string) => `/uploads/${key}`), discardAttachment: vi.fn(), saveAttachment: vi.fn() }));
const transaction = vi.hoisted(() => ({ $executeRaw: vi.fn(), ticket: { findFirst: vi.fn() }, attachment: { count: vi.fn(), create: vi.fn() } }));
const prisma = vi.hoisted(() => ({
  requester: { findFirst: vi.fn() },
  attachment: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));
vi.mock("../../src/attachment-storage.js", () => storage);

import { app } from "../../src/app.js";

const attachment = { id: 4, originalName: "vpn.pdf", mimeType: "application/pdf", sizeBytes: 3, createdAt: new Date(), removedAt: null, removalReason: null };
const pdf = Buffer.from("%PDF-1.4\n");

beforeEach(() => {
  vi.resetAllMocks();
  prisma.requester.findFirst.mockResolvedValue({ id: 1 });
  prisma.$transaction.mockImplementation((callback: (client: typeof transaction) => unknown) => callback(transaction));
});

describe("requester attachments", () => {
  it("uploads a permitted owned attachment and rejects unsupported or unowned uploads", async () => {
    transaction.ticket.findFirst.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    transaction.attachment.count.mockResolvedValue(0);
    transaction.attachment.create.mockResolvedValue(attachment);

    const created = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", pdf, { filename: "vpn.pdf", contentType: "application/pdf" });
    const rejected = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.from("text"), { filename: "note.txt", contentType: "text/plain" });
    const unowned = await request(app).post("/api/tickets/2/attachments").field("requesterId", "1").attach("file", pdf, { filename: "vpn.pdf", contentType: "application/pdf" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ originalName: "vpn.pdf" });
    expect(rejected.status).toBe(415);
    expect(unowned.status).toBe(404);
  });

  it("rejects spoofed PDF content before storing it", async () => {
    const response = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.from("not a PDF"), { filename: "spoofed.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(415);
    expect(storage.saveAttachment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns attachment metadata only for its owner", async () => {
    prisma.attachment.findFirst.mockResolvedValueOnce(attachment).mockResolvedValueOnce(null);

    const owned = await request(app).get("/api/attachments/4?requesterId=1");
    const unowned = await request(app).get("/api/attachments/5?requesterId=1");

    expect(owned.status).toBe(200);
    expect(owned.body).toMatchObject({ originalName: "vpn.pdf" });
    expect(unowned.status).toBe(404);
  });

  it("serializes the active-file check with a per-ticket transaction lock", async () => {
    const oversized = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "large.pdf", contentType: "application/pdf" });
    transaction.ticket.findFirst.mockResolvedValue({ id: 1 });
    transaction.attachment.count.mockResolvedValue(5);
    const sixth = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", pdf, { filename: "sixth.pdf", contentType: "application/pdf" });
    prisma.attachment.findFirst.mockResolvedValue(null);
    const removedDownload = await request(app).get("/api/attachments/4/download?requesterId=1");

    expect(oversized.status).toBe(413);
    expect(sixth.status).toBe(409);
    expect(removedDownload.status).toBe(404);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock");
    expect(transaction.attachment.create).not.toHaveBeenCalled();
  });

  it("discards a stored file when the attachment transaction fails", async () => {
    transaction.ticket.findFirst.mockResolvedValue({ id: 1 });
    transaction.attachment.count.mockResolvedValue(0);
    transaction.attachment.create.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).post("/api/tickets/1/attachments").field("requesterId", "1").attach("file", pdf, { filename: "vpn.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(500);
    expect(storage.saveAttachment).toHaveBeenCalledTimes(1);
    expect(storage.discardAttachment).toHaveBeenCalledTimes(1);
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
