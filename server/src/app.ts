import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";
import { attachmentPath, discardAttachment, saveAttachment } from "./attachment-storage.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statuses = ["NEW"] as const;
const sortFields = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority"] as const;
const attachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const attachmentSelect = { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true } as const;

class AttachmentTypeError extends Error {}
class AttachmentLimitError extends Error {}
class TicketNotFoundError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (attachmentTypes.includes(file.mimetype)) callback(null, true);
    else callback(new AttachmentTypeError());
  },
});

class RequestError extends Error {
  constructor(readonly message: string) { super(message); }
}

function requiredId(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new RequestError(`${name} must be a positive integer.`);
  }
  return value;
}

function requiredText(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "string") throw new RequestError(`${name} is required.`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new RequestError(`${name} must be between ${min} and ${max} characters.`);
  return text;
}

function requestedPriority(value: unknown) {
  if (value === undefined) return "MEDIUM";
  if (typeof value !== "string" || !priorities.includes(value as typeof priorities[number])) {
    throw new RequestError("requestedPriority must be LOW, MEDIUM, HIGH, or URGENT.");
  }
  return value as typeof priorities[number];
}

function queryInteger(value: unknown, name: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new RequestError(`${name} must be a positive integer.`);
  return requiredId(Number(value), name);
}

function queryChoice<T extends readonly string[]>(value: unknown, name: string, choices: T, fallback: T[number]) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !choices.includes(value)) throw new RequestError(`${name} is invalid.`);
  return value as T[number];
}

function multipartId(value: unknown, name: string) {
  if (typeof value === "string" && /^\d+$/.test(value)) return requiredId(Number(value), name);
  return requiredId(value, name);
}

function hasAttachmentSignature(file: { mimetype: string; buffer: Buffer }) {
  const { buffer, mimetype } = file;
  if (mimetype === "application/pdf") return buffer.subarray(0, 5).equals(Buffer.from("%PDF-"));
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

async function requireActiveRequester(prisma: PrismaClient, requesterId: number) {
  const requester = await prisma.requester.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
  if (!requester) throw new RequestError("Requester is unavailable.");
}

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json({ limit: "100kb" }));
app.use((error: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON request body." });
    return;
  }
  if (error.type === "entity.too.large") {
    res.status(413).json({ error: "Request body exceeds the size limit." });
    return;
  }
  next(error);
});

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Unable to load request categories." });
  }
});

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requester.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.json(requesters);
  } catch {
    res.status(500).json({ error: "Unable to load requesters." });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.json(relatedSystems);
  } catch {
    res.status(500).json({ error: "Unable to load related systems." });
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requesterId = queryInteger(req.query.requesterId, "requesterId");
    const categoryId = req.query.categoryId === undefined ? undefined : queryInteger(req.query.categoryId, "categoryId");
    const requestedPriority = req.query.requestedPriority === undefined ? undefined : queryChoice(req.query.requestedPriority, "requestedPriority", priorities, "MEDIUM");
    const status = req.query.status === undefined ? undefined : queryChoice(req.query.status, "status", statuses, "NEW");
    const sortBy = queryChoice(req.query.sortBy, "sortBy", sortFields, "updatedAt");
    const direction = queryChoice(req.query.direction, "direction", ["asc", "desc"] as const, "desc");
    const page = queryInteger(req.query.page, "page", 1);
    const pageSize = queryInteger(req.query.pageSize, "pageSize", 10);
    if (![5, 10, 20].includes(pageSize)) throw new RequestError("pageSize must be 5, 10, or 20.");
    const search = req.query.search === undefined ? undefined : typeof req.query.search === "string" ? req.query.search.trim() : (() => { throw new RequestError("search is invalid."); })();
    const where: Prisma.TicketWhereInput = { requesterId, categoryId, requestedPriority, status };
    if (search) where.OR = [{ ticketNumber: { contains: search, mode: "insensitive" } }, { summary: { contains: search, mode: "insensitive" } }];
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const [items, totalItems] = await Promise.all([
      prisma.ticket.findMany({ where, orderBy: [{ [sortBy]: direction }, { id: direction }], skip: (page - 1) * pageSize, take: pageSize, select: { id: true, ticketNumber: true, summary: true, requestedPriority: true, status: true, createdAt: true, updatedAt: true, category: { select: { id: true, name: true } } } }),
      prisma.ticket.count({ where }),
    ]);
    res.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load tickets." });
  }
});

app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const requesterId = queryInteger(req.query.requesterId, "requesterId");
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: { id: true, ticketNumber: true, requesterId: true, summary: true, description: true, requestedPriority: true, status: true, createdAt: true, updatedAt: true, category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } }, attachments: { orderBy: { createdAt: "desc" }, select: attachmentSelect } },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    res.json(ticket);
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load ticket." });
  }
});

app.post("/api/tickets/:ticketId/attachments", upload.single("file"), async (req: Request, res: Response) => {
  let storageKey: string | null = null;
  try {
    const requesterId = multipartId(req.body?.requesterId, "requesterId");
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!req.file || req.file.originalname.length === 0 || req.file.originalname.length > 255) throw new RequestError("Attachment filename is invalid.");
    const file = req.file;
    if (!hasAttachmentSignature(file)) throw new AttachmentTypeError();
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const attachment = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
      if (!ticket) throw new TicketNotFoundError();
      if (await transaction.attachment.count({ where: { ticketId, removedAt: null } }) >= 5) throw new AttachmentLimitError();
      storageKey = randomUUID();
      await saveAttachment(storageKey, file.buffer);
      return transaction.attachment.create({ data: { ticketId, originalName: file.originalname, storageKey, mimeType: file.mimetype, sizeBytes: file.size }, select: attachmentSelect });
    });
    res.status(201).json(attachment);
  } catch (error) {
    if (storageKey) await discardAttachment(storageKey);
    if (error instanceof AttachmentTypeError) {
      res.status(415).json({ error: "Attachment type is not permitted." });
      return;
    }
    if (error instanceof TicketNotFoundError) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    if (error instanceof AttachmentLimitError) {
      res.status(409).json({ error: "A ticket can have at most five active attachments." });
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to upload attachment." });
  }
});

app.get("/api/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const requesterId = queryInteger(req.query.requesterId, "requesterId");
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, ticket: { requesterId } }, select: attachmentSelect });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    res.json(attachment);
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load attachment." });
  }
});

app.get("/api/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const requesterId = queryInteger(req.query.requesterId, "requesterId");
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, removedAt: null, ticket: { requesterId } }, select: { originalName: true, mimeType: true, storageKey: true } });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    res.type(attachment.mimeType).download(attachmentPath(attachment.storageKey), attachment.originalName, (error) => {
      if (error && !res.headersSent) res.status(500).json({ error: "Unable to download attachment." });
    });
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to download attachment." });
  }
});

app.delete("/api/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const requesterId = requiredId(req.body?.requesterId, "requesterId");
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const reason = requiredText(req.body?.reason, "reason", 1, 500);
    const prisma = getPrisma();
    await requireActiveRequester(prisma, requesterId);
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, removedAt: null, ticket: { requesterId } }, select: { id: true } });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    res.json(await prisma.attachment.update({ where: { id: attachmentId }, data: { removedAt: new Date(), removalReason: reason }, select: attachmentSelect }));
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to remove attachment." });
  }
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requesterId = requiredId(req.body?.requesterId, "requesterId");
    const categoryId = requiredId(req.body?.categoryId, "categoryId");
    const relatedSystemId = requiredId(req.body?.relatedSystemId, "relatedSystemId");
    const summary = requiredText(req.body?.summary, "summary", 5, 200);
    const description = requiredText(req.body?.description, "description", 10, 4_000);
    const priority = requestedPriority(req.body?.requestedPriority);
    const prisma = getPrisma();
    const [requester, category, relatedSystem] = await Promise.all([
      prisma.requester.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } }),
      prisma.category.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { id: relatedSystemId, isActive: true }, select: { id: true } }),
    ]);

    if (!requester || !category || !relatedSystem) throw new RequestError("Requester or reference data is unavailable.");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: generateTicketNumber(), requesterId, categoryId, relatedSystemId,
            requestedPriority: priority, status: "NEW", summary, description,
          },
        });
        res.status(201).json(ticket);
        return;
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002") || attempt === 2) throw error;
      }
    }
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to create ticket." });
  }
});

app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Attachment exceeds the 5 MB limit." : "Invalid attachment upload." });
    return;
  }
  if (error instanceof AttachmentTypeError) {
    res.status(415).json({ error: "Attachment type is not permitted." });
    return;
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: "Unexpected server error." });
});

export default app;
