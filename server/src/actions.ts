import type { Express, Request, RequestHandler, Response } from "express";
import { createHash } from "node:crypto";
import type { ActionStatus, Prisma, TicketStatus } from "@prisma/client";
import { noStore, requireAllowedOrigin, type AuthenticatedRequest } from "./auth.js";
import { getPrisma } from "./prisma.js";

const personSelect = { id: true, name: true, role: true } as const;
const people = { performedBy: { select: personSelect }, assignee: { select: personSelect } } as const;
type Action = Prisma.ActionTakenGetPayload<{ include: typeof people }>;
type Transaction = Prisma.TransactionClient;
type Body = Record<string, unknown>;
const actionable: readonly TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const transitions: Record<ActionStatus, readonly ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [],
};

class ActionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly field?: string) { super(message); }
}
function invalid(field: string, message: string): never { throw new ActionError(400, "VALIDATION_ERROR", message, field); }
function conflict(code: string, message: string): never { throw new ActionError(409, code, message); }
function missing(): never { throw new ActionError(404, "NOT_FOUND", "Ticket or Action not found."); }
function id(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) invalid(field, `${field} must be a positive integer.`);
  return value;
}
function pathId(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) invalid(field, `${field} must be a positive integer.`);
  return id(Number(value), field);
}
function version(value: unknown, field: "expectedVersion" | "expectedWorkflowVersion") {
  if (value === undefined) conflict(field === "expectedVersion" ? "STALE_ACTION" : "STALE_TICKET_WORKFLOW", `${field} is required. Refresh and retry.`);
  return id(value, field);
}
function object(value: unknown, allowed: readonly string[]): Body {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("body", "Request body must be an object.");
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(key, `${key} is not allowed.`);
  return value as Body;
}
function text(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) invalid(field, `${field} is required.`);
    return null;
  }
  if (typeof value !== "string") invalid(field, `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max || (required && !trimmed.length)) invalid(field, `${field} must contain ${required ? "1" : "0"}–${max} characters.`);
  return trimmed || null;
}
function timestamp(value: unknown): Date {
  if (typeof value !== "string") invalid("actionAt", "actionAt requires an ISO 8601 timestamp with an explicit offset.");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) invalid("actionAt", "actionAt requires an ISO 8601 timestamp with an explicit offset.");
  const [, yearText, monthText, dayText, hourText, minuteText, secondsText, , offset] = match;
  const [year, month, day, hour, minute, seconds] = [yearText, monthText, dayText, hourText, minuteText, secondsText ?? "0"].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const date = new Date(value);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || seconds > 59
    || (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59)) || !Number.isFinite(date.getTime())) {
    invalid("actionAt", "actionAt must be a valid calendar timestamp.");
  }
  return date;
}
function fields(body: Body, current?: Action) {
  const actionAt = "actionAt" in body ? timestamp(body.actionAt) : current?.actionAt;
  if (!actionAt) invalid("actionAt", "actionAt is required.");
  const description = text("description" in body ? body.description : current?.description, "description", 2000, true)!;
  const followUpRequired = "followUpRequired" in body ? body.followUpRequired : current?.followUpRequired;
  if (typeof followUpRequired !== "boolean") invalid("followUpRequired", "followUpRequired must be a boolean.");
  const note = text("followUpNote" in body ? body.followUpNote : current?.followUpNote, "followUpNote", 1000, followUpRequired);
  const result = text("result" in body ? body.result : current?.result, "result", 2000, current?.status === "COMPLETED");
  const attachmentNotes = text("attachmentNotes" in body ? body.attachmentNotes : current?.attachmentNotes, "attachmentNotes", 1000);
  return { actionAt, description, followUpRequired, followUpNote: followUpRequired ? note : null, result, attachmentNotes };
}

function record(action: Action) {
  return {
    id: action.id, ticketId: action.ticketId, actionAt: action.actionAt.toISOString(), description: action.description, result: action.result,
    performedBy: action.performedBy, assignee: action.assignee, status: action.status, followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes, version: action.version,
    createdAt: action.createdAt.toISOString(), updatedAt: action.updatedAt.toISOString(),
  };
}
function snapshot(action: Action): Prisma.InputJsonObject {
  const { id: _id, ticketId: _ticketId, createdAt: _createdAt, updatedAt: _updatedAt, ...state } = record(action);
  return state;
}
// Apply the public allowlist to stored historical JSON as well as new snapshots.
function publicSnapshot(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const person = (raw: Prisma.JsonValue | undefined) => raw && typeof raw === "object" && !Array.isArray(raw)
    ? { id: raw.id, name: raw.name, role: raw.role } : null;
  return {
    actionAt: value.actionAt, description: value.description, result: value.result,
    performedBy: person(value.performedBy), assignee: person(value.assignee), status: value.status,
    followUpRequired: value.followUpRequired, followUpNote: value.followUpNote, attachmentNotes: value.attachmentNotes, version: value.version,
  };
}
function actor(req: Request) { return (req as AuthenticatedRequest).auth!.user; }
async function lockTicket(tx: Transaction, ticketId: number) {
  // This is the same lock used by the inherited Ticket status route.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) missing();
  return ticket;
}
function writable(ticket: { status: TicketStatus; workflowVersion: number }, expected: number) {
  if (!actionable.includes(ticket.status)) conflict("ACTION_TICKET_NOT_MUTABLE", "Reopen this Ticket before changing Actions.");
  if (ticket.workflowVersion !== expected) conflict("STALE_TICKET_WORKFLOW", "The Ticket has changed. Refresh and retry.");
}
async function assignee(tx: Transaction, value: unknown): Promise<number | null> {
  if (value === undefined || value === null) return null;
  const userId = id(value, "assigneeId");
  // Hold the account row through commit so deactivation or a role change cannot
  // race an assignment that was validated as active support staff.
  const users = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "User" WHERE id = ${userId} AND "isActive" = true AND role IN ('IT_STAFF', 'ADMINISTRATOR') FOR SHARE`;
  if (!users.length) conflict("ACTION_ASSIGNEE_UNAVAILABLE", "The selected assignee is unavailable.");
  return userId;
}
async function advance(tx: Transaction, ticketId: number, updatedAt: Date) {
  await tx.ticket.update({ where: { id: ticketId }, data: { workflowVersion: { increment: 1 }, updatedAt } });
}
function handle(run: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return async (req, res) => {
    try {
      if (Object.keys(req.query).length) invalid("query", "Query parameters are not allowed.");
      if (req.method !== "GET" && !requireAllowedOrigin(req, res)) return;
      await run(req, res);
    } catch (error) {
      if (error instanceof ActionError) {
        res.status(error.status).json({ error: error.message, code: error.code, ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}) });
      } else {
        res.status(500).json({ error: "Unable to process Action request." });
      }
    }
  };
}
const cache: RequestHandler = (_req, res, next) => { noStore(res); next(); };

export function registerActionRoutes(app: Express, authenticated: RequestHandler[], support: RequestHandler[]) {
  app.get("/api/tickets/:ticketId/actions", cache, ...authenticated, handle(async (req, res) => {
    if (req.body !== undefined) object(req.body, []);
    const ticketId = pathId(req.params.ticketId, "ticketId");
    const user = actor(req);
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, ...(user.role === "REQUESTER" ? { requesterId: user.id } : {}) }, select: { id: true } });
    if (!ticket) missing();
    const orderBy = [{ actionAt: "asc" }, { id: "asc" }] as const;
    if (user.role === "REQUESTER") {
      const rows = await prisma.actionTaken.findMany({ where: { ticketId }, include: people, orderBy: [...orderBy] });
      res.json(rows.map(record));
    } else {
      const rows = await prisma.actionTaken.findMany({
        where: { ticketId }, include: { ...people, events: { include: { actor: { select: personSelect } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }, orderBy: [...orderBy],
      });
      res.json(rows.map((row) => ({ ...record(row), events: row.events.map((event) => ({
        id: event.id, actionId: event.actionId, actor: event.actor, type: event.type,
        before: publicSnapshot(event.before), after: publicSnapshot(event.after), createdAt: event.createdAt.toISOString(),
      })) })));
    }
  }));

  app.post("/api/staff/tickets/:ticketId/actions", cache, ...support, handle(async (req, res) => {
    const ticketId = pathId(req.params.ticketId, "ticketId");
    const body = object(req.body, ["actionAt", "description", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes", "expectedWorkflowVersion"]);
    const expected = version(body.expectedWorkflowVersion, "expectedWorkflowVersion");
    const key = req.get("Idempotency-Key");
    if (!key || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(key)) invalid("Idempotency-Key", "A UUID Idempotency-Key header is required.");
    const normalizedKey = key.toLowerCase();
    const data = fields(body);
    const assigneeId = body.assigneeId === null || body.assigneeId === undefined ? null : id(body.assigneeId, "assigneeId");
    const user = actor(req);
    // Control versions are not Action content. A replay checks the normalized
    // creation payload and original actor even if the Action has since changed.
    const creationFingerprint = createHash("sha256").update(JSON.stringify({ ticketId, ...data, performedById: user.id, assigneeId })).digest("hex");
    const result = await getPrisma().$transaction(async (tx) => {
      // A global key lock also serializes reuse across different parent Tickets.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(69069, hashtext(${normalizedKey}))`;
      const existing = await tx.actionTaken.findUnique({ where: { idempotencyKey: normalizedKey }, include: people });
      if (existing) {
        if (existing.ticketId !== ticketId || existing.performedById !== user.id || existing.creationFingerprint !== creationFingerprint) conflict("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different request.");
        return { action: existing, replayed: true };
      }
      const ticket = await lockTicket(tx, ticketId);
      writable(ticket, expected);
      await assignee(tx, assigneeId);
      const now = new Date(Math.max(Date.now(), ticket.updatedAt.getTime() + 1));
      const action = await tx.actionTaken.create({ data: { ...data, ticketId, performedById: user.id, assigneeId, status: "PLANNED", version: 1, idempotencyKey: normalizedKey, creationFingerprint, createdAt: now, updatedAt: now }, include: people });
      await tx.actionEvent.create({ data: { actionId: action.id, actorId: user.id, type: "CREATED", after: snapshot(action), createdAt: now } });
      await advance(tx, ticketId, now);
      return { action, replayed: false };
    });
    if (result.replayed) res.set("Idempotent-Replayed", "true");
    res.status(result.replayed ? 200 : 201).json(record(result.action));
  }));

  for (const operation of ["edit", "assignee", "status"] as const) {
    const suffix = operation === "edit" ? "" : `/${operation}`;
    app.patch(`/api/staff/actions/:actionId${suffix}`, cache, ...support, handle(async (req, res) => {
      const actionId = pathId(req.params.actionId, "actionId");
      const contentFields = ["actionAt", "description", "result", "followUpRequired", "followUpNote", "attachmentNotes"];
      const allowed = operation === "edit" ? contentFields : operation === "assignee" ? ["assigneeId"] : ["status", "result"];
      const body = object(req.body, ["expectedVersion", "expectedWorkflowVersion", ...allowed]);
      const expectedWorkflow = version(body.expectedWorkflowVersion, "expectedWorkflowVersion");
      const expectedAction = version(body.expectedVersion, "expectedVersion");
      if (operation === "edit" && !contentFields.some((field) => field in body)) invalid("body", "At least one editable field is required.");
      const action = await getPrisma().$transaction(async (tx) => {
        const reference = await tx.actionTaken.findUnique({ where: { id: actionId }, select: { ticketId: true } });
        if (!reference) missing();
        const ticket = await lockTicket(tx, reference.ticketId);
        writable(ticket, expectedWorkflow);
        const current = await tx.actionTaken.findUnique({ where: { id: actionId }, include: people });
        if (!current) missing();
        if (current.version !== expectedAction) conflict("STALE_ACTION", "The Action has changed. Refresh and retry.");
        let changes: Prisma.ActionTakenUncheckedUpdateInput;
        if (operation === "edit") {
          changes = fields(body, current);
        } else if (operation === "assignee") {
          if (current.status === "COMPLETED" || current.status === "CANCELLED") conflict("ACTION_TERMINAL", "A terminal Action cannot be reassigned.");
          if (!("assigneeId" in body)) invalid("assigneeId", "assigneeId is required; use null to unassign.");
          const assigneeId = body.assigneeId === null ? null : id(body.assigneeId, "assigneeId");
          if (current.assigneeId === assigneeId) return current;
          await assignee(tx, assigneeId);
          changes = { assigneeId };
        } else {
          if (typeof body.status !== "string" || !["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(body.status)) invalid("status", "status must be IN_PROGRESS, COMPLETED, or CANCELLED.");
          const status = body.status as ActionStatus;
          if (!transitions[current.status].includes(status)) conflict("INVALID_ACTION_TRANSITION", "That Action status transition is not permitted.");
          if (status !== "COMPLETED" && "result" in body) invalid("result", "Supply result when completing an Action, or use the edit operation.");
          changes = { status, ...(status === "COMPLETED" ? { result: text(body.result, "result", 2000, true) } : {}) };
        }
        const now = new Date(Math.max(Date.now(), ticket.updatedAt.getTime() + 1, current.updatedAt.getTime() + 1));
        const updated = await tx.actionTaken.update({ where: { id: actionId }, data: { ...changes, version: { increment: 1 }, updatedAt: now }, include: people });
        await tx.actionEvent.create({ data: {
          actionId, actorId: actor(req).id, type: operation === "edit" ? "EDITED" : operation === "assignee" ? "ASSIGNED" : "STATUS_CHANGED",
          before: snapshot(current), after: snapshot(updated), createdAt: now,
        } });
        await advance(tx, ticket.id, now);
        return updated;
      });
      res.json(record(action));
    }));
  }
}
