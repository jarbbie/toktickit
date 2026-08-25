import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statuses = ["NEW"] as const;
const sortFields = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority"] as const;

class RequestError extends Error {
  constructor(readonly message: string) { super(message); }
}

function requiredId(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
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

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());
app.use((error: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON request body." });
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
    const [items, totalItems] = await Promise.all([
      prisma.ticket.findMany({ where, orderBy: { [sortBy]: direction }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, ticketNumber: true, summary: true, requestedPriority: true, status: true, updatedAt: true, category: { select: { id: true, name: true } } } }),
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

export default app;
