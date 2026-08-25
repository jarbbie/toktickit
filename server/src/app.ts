import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

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
