import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";
import { attachmentPath, discardAttachment, saveAttachment } from "./attachment-storage.js";
import {
  clearSessionCookie, configuredClientOrigin, hashPassword, hashSessionToken,
  identity, loadAuthentication, loginLimiter, noStore, normalizeEmail,
  passwordError, requireAllowedOrigin, requirePasswordChanged, requireRole, sessionExpiry, setSessionCookie,
  generateSessionToken, verifyPassword,
  authenticate, type AuthenticatedRequest,
} from "./auth.js";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const sortFields = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority"] as const;
const staffSortFields = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status"] as const;
const ownershipFilters = ["all", "mine", "assigned", "unassigned"] as const;
const priorityRank: Record<typeof priorities[number], number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
const statusRank: Record<typeof statuses[number], number> = Object.fromEntries(statuses.map((status, index) => [status, index])) as Record<typeof statuses[number], number>;
const attachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const userRoles = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
const userAccountLockKey = 44044;
const attachmentSelect = { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true } as const;
const personSelect = { id: true, name: true } as const;
const adminUserSelect = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;

class AttachmentTypeError extends Error {}
class AttachmentLimitError extends Error {}
class TicketNotFoundError extends Error {}
class ResolutionConflictError extends Error {}
class TicketAlreadyAssignedError extends Error {}
class OwnerUnavailableError extends Error {}
class InvalidStatusTransitionError extends Error {}
class UserNotFoundError extends Error {}
class EmailInUseError extends Error {}
class AdminSafetyConflictError extends Error {
  constructor(readonly code: "SELF_DEACTIVATION" | "LAST_ACTIVE_ADMINISTRATOR" | "ASSIGNED_TICKET_OWNER", message: string) { super(message); }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (attachmentTypes.includes(file.mimetype)) callback(null, true);
    else callback(new AttachmentTypeError());
  },
});

class RequestError extends Error {
  constructor(readonly message: string, readonly field?: string) { super(message); }
}

function requiredId(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
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

function adminName(value: unknown) {
  if (typeof value !== "string") throw new RequestError("Name is required.", "name");
  const name = value.trim();
  if (name.length < 1 || name.length > 100) throw new RequestError("Name must be between 1 and 100 characters.", "name");
  return name;
}

function adminEmail(value: unknown) {
  const email = normalizeEmail(value);
  if (!email) throw new RequestError("Enter a valid email address.", "email");
  return email;
}

function adminRole(value: unknown) {
  if (typeof value !== "string" || !userRoles.includes(value as typeof userRoles[number])) {
    throw new RequestError("Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.", "role");
  }
  return value as UserRole;
}

function adminActive(value: unknown) {
  if (typeof value !== "boolean") throw new RequestError("isActive must be a boolean.", "isActive");
  return value;
}

function adminPassword(value: unknown) {
  const problem = passwordError(value);
  if (problem) throw new RequestError(problem, "initialPassword");
  return value as string;
}

function validationResponse(response: Response, error: RequestError) {
  response.status(400).json({
    error: error.message,
    code: "VALIDATION_ERROR",
    ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}),
  });
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function validateObject(value: unknown, allowed: readonly string[], name = "request body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(`${name} must be an object.`);
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new RequestError(`${unknown} is not allowed.`);
  return value as Record<string, unknown>;
}

function validateQuery(query: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(query).find((key) => !allowed.includes(key));
  if (unknown) throw new RequestError(`${unknown} is not allowed.`);
}

function requestedPriority(value: unknown) {
  if (value === undefined) return "MEDIUM";
  if (typeof value !== "string" || !priorities.includes(value as typeof priorities[number])) {
    throw new RequestError("requestedPriority must be LOW, MEDIUM, HIGH, or URGENT.");
  }
  return value as typeof priorities[number];
}

function requiredPriority(value: unknown, name: string) {
  if (typeof value !== "string" || !priorities.includes(value as typeof priorities[number])) {
    throw new RequestError(`${name} must be LOW, MEDIUM, HIGH, or URGENT.`);
  }
  return value as typeof priorities[number];
}

function requiredStatus(value: unknown) {
  if (typeof value !== "string" || !statuses.includes(value as typeof statuses[number])) {
    throw new RequestError("status is invalid.");
  }
  return value as typeof statuses[number];
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

function optionalQueryChoice<T extends readonly string[]>(value: unknown, name: string, choices: T) {
  if (value === undefined) return undefined;
  return queryChoice(value, name, choices, choices[0]);
}

function hasAttachmentSignature(file: { mimetype: string; buffer: Buffer }) {
  const { buffer, mimetype } = file;
  if (mimetype === "application/pdf") return buffer.subarray(0, 5).equals(Buffer.from("%PDF-"));
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function authenticateCurrent(request: Request, response: Response, next: NextFunction) {
  return authenticate(getPrisma())(request as AuthenticatedRequest, response, next);
}

const completedAuthentication = [authenticateCurrent, requirePasswordChanged];
const requesterAuthentication = [authenticateCurrent, requirePasswordChanged, requireRole("REQUESTER")];
const staffAuthentication = [authenticateCurrent, requirePasswordChanged, requireRole("IT_STAFF", "ADMINISTRATOR")];
const adminAuthentication = [authenticateCurrent, requirePasswordChanged, requireRole("ADMINISTRATOR")];

function authenticatedUser(request: Request) {
  return (request as AuthenticatedRequest).auth!.user;
}

function notFound(res: Response, message: string) {
  res.status(404).json({ error: message, code: "NOT_FOUND" });
}

function conflict(res: Response, message: string) {
  res.status(409).json({ error: message, code: "CONFLICT" });
}

function conflictWithCode(res: Response, message: string, code: string) {
  res.status(409).json({ error: message, code });
}

function conflictWithField(res: Response, message: string, code: string, field: string) {
  res.status(409).json({ error: message, code, fieldErrors: { [field]: message } });
}

async function findReadableTicket(prisma: PrismaClient, ticketId: number, request: Request) {
  const user = authenticatedUser(request);
  return prisma.ticket.findFirst({
    where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
    select: { id: true },
  });
}

function publicCommentDto(comment: { id: number; ticketId: number; content: string; createdAt: Date; author: { id: number; name: string } }) {
  return { id: comment.id, ticketId: comment.ticketId, body: comment.content, author: comment.author, createdAt: comment.createdAt };
}

function comparePriority(a: { requestedPriority: typeof priorities[number]; id: number }, b: { requestedPriority: typeof priorities[number]; id: number }, direction: "asc" | "desc") {
  const priorityDifference = priorityRank[a.requestedPriority] - priorityRank[b.requestedPriority];
  if (priorityDifference !== 0) return direction === "asc" ? priorityDifference : -priorityDifference;
  return direction === "asc" ? a.id - b.id : b.id - a.id;
}

type StaffQueueRow = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: typeof priorities[number];
  itPriority: typeof priorities[number];
  status: typeof statuses[number];
  resolutionIndicatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string };
  requester: { id: number; name: string };
  owner: { id: number; name: string; role: "IT_STAFF" | "ADMINISTRATOR" } | null;
};

function compareStaffQueue(a: StaffQueueRow, b: StaffQueueRow, sortBy: typeof staffSortFields[number], direction: "asc" | "desc") {
  let comparison = 0;
  if (sortBy === "requestedPriority") comparison = priorityRank[a.requestedPriority] - priorityRank[b.requestedPriority];
  else if (sortBy === "itPriority") comparison = priorityRank[a.itPriority] - priorityRank[b.itPriority];
  else if (sortBy === "status") comparison = statusRank[a.status] - statusRank[b.status];
  else if (sortBy === "ticketNumber") comparison = a.ticketNumber.localeCompare(b.ticketNumber);
  else if (sortBy === "createdAt") comparison = a.createdAt.getTime() - b.createdAt.getTime();
  else comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
  if (comparison === 0) comparison = a.id - b.id;
  return direction === "asc" ? comparison : -comparison;
}

const allowedStatusTransitions: Record<typeof statuses[number], readonly typeof statuses[number][]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

const staffTicketSelect = {
  id: true,
  ticketNumber: true,
  requesterId: true,
  categoryId: true,
  relatedSystemId: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  status: true,
  ownerId: true,
  resolutionIndicatedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: personSelect },
  owner: { select: { id: true, name: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: attachmentSelect },
} satisfies Prisma.TicketSelect;

type StaffDataClient = Pick<PrismaClient, "ticket" | "user">;

async function loadStaffTicketDetail(prisma: StaffDataClient, ticketId: number) {
  const [ticket, ownerOptions] = await Promise.all([
    prisma.ticket.findFirst({ where: { id: ticketId }, select: staffTicketSelect }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, role: true },
    }),
  ]);
  if (!ticket) throw new TicketNotFoundError();
  return { ...ticket, ownerOptions };
}

function internalNoteDto(note: { id: number; ticketId: number; content: string; createdAt: Date; author: { id: number; name: string } }) {
  return { id: note.id, ticketId: note.ticketId, body: note.content, author: note.author, createdAt: note.createdAt };
}

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, !origin || origin === configuredClientOrigin());
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
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

function validAuthBody(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => fields.includes(key));
}

function loginFailure(response: Response) {
  noStore(response);
  response.status(401).json({ error: "Unable to sign in. Check your credentials or contact an administrator.", code: "INVALID_CREDENTIALS" });
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  if (!requireAllowedOrigin(req, res)) return;
  if (!validAuthBody(req.body, ["email", "password"])) {
    res.status(400).json({ error: "Email and password are required.", code: "VALIDATION_ERROR" });
    return;
  }
  const email = normalizeEmail(req.body.email);
  const passwordProblem = passwordError(req.body.password);
  if (!email || passwordProblem) {
    res.status(400).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fieldErrors: {
      ...(!email ? { email: "Enter a valid email address." } : {}),
      ...(passwordProblem ? { password: passwordProblem } : {}),
    } });
    return;
  }
  const ip = req.socket.remoteAddress ?? "unknown";
  const retryAfter = loginLimiter.retryAfter(email, ip);
  if (retryAfter > 0) {
    noStore(res);
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many sign-in attempts. Please try again later.", code: "LOGIN_THROTTLED" });
    return;
  }
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, passwordHash: true },
    });
    const validPassword = await verifyPassword(user?.passwordHash ?? null, req.body.password);
    if (!user || !user.isActive || !validPassword) {
      loginLimiter.failure(email, ip);
      loginFailure(res);
      return;
    }
    loginLimiter.success(email, ip);
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = sessionExpiry();
    const priorAuth = await loadAuthentication(prisma, req as import("./auth.js").AuthenticatedRequest);
    await prisma.$transaction(async (transaction) => {
      if (priorAuth) await transaction.session.delete({ where: { tokenHash: priorAuth.tokenHash } });
      await transaction.session.create({ data: { userId: user.id, tokenHash, expiresAt } });
    });
    setSessionCookie(res, token, expiresAt);
    noStore(res);
    res.json({ user: identity(user), expiresAt });
  } catch {
    res.status(500).json({ error: "Unable to sign in." });
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const auth = await loadAuthentication(getPrisma(), req as import("./auth.js").AuthenticatedRequest);
    if (!auth) {
      noStore(res);
      res.status(401).json({ error: "Authentication is required.", code: "UNAUTHENTICATED" });
      return;
    }
    noStore(res);
    res.json({ user: identity(auth.user), expiresAt: auth.expiresAt });
  } catch {
    res.status(500).json({ error: "Unable to retrieve the current user." });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const auth = await loadAuthentication(prisma, req as import("./auth.js").AuthenticatedRequest);
    if (auth && !requireAllowedOrigin(req, res)) return;
    if (auth) await prisma.session.delete({ where: { tokenHash: auth.tokenHash } });
    clearSessionCookie(res);
    noStore(res);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Unable to sign out." });
  }
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const auth = await loadAuthentication(prisma, req as import("./auth.js").AuthenticatedRequest);
    if (!auth) {
      noStore(res);
      res.status(401).json({ error: "Authentication is required.", code: "UNAUTHENTICATED" });
      return;
    }
    if (!requireAllowedOrigin(req, res)) return;
    if (!validAuthBody(req.body, ["currentPassword", "newPassword"])) {
      res.status(400).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR" });
      return;
    }
    const currentProblem = passwordError(req.body.currentPassword);
    const newProblem = passwordError(req.body.newPassword);
    if (currentProblem || newProblem) {
      res.status(400).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fieldErrors: {
        ...(currentProblem ? { currentPassword: currentProblem } : {}),
        ...(newProblem ? { newPassword: newProblem } : {}),
      } });
      return;
    }
    const current = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
    if (!current || !await verifyPassword(current.passwordHash, req.body.currentPassword)) {
      res.status(400).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fieldErrors: { currentPassword: "Current password is incorrect." } });
      return;
    }
    if (await verifyPassword(current.passwordHash, req.body.newPassword)) {
      res.status(400).json({ error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fieldErrors: { newPassword: "New password must differ from the current password." } });
      return;
    }
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = sessionExpiry();
    const passwordHash = await hashPassword(req.body.newPassword);
    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: auth.user.id },
        data: { passwordHash, mustChangePassword: false },
        select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
      });
      await transaction.session.deleteMany({ where: { userId: auth.user.id } });
      await transaction.session.create({ data: { userId: auth.user.id, tokenHash, expiresAt } });
      return updated;
    });
    setSessionCookie(res, token, expiresAt);
    noStore(res);
    res.json({ user: identity(user), expiresAt });
  } catch {
    res.status(500).json({ error: "Unable to change password." });
  }
});

app.get("/api/admin/users", ...adminAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, ["search", "role"]);
    const search = req.query.search === undefined
      ? undefined
      : typeof req.query.search === "string"
        ? req.query.search.trim()
        : (() => { throw new RequestError("search is invalid.", "search"); })();
    if (search !== undefined && search.length > 200) throw new RequestError("Search must be no longer than 200 characters.", "search");
    const role = optionalQueryChoice(req.query.role, "role", userRoles);
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
    };
    const users = await getPrisma().user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: adminUserSelect,
    });
    noStore(res);
    res.json(users);
  } catch (error) {
    if (error instanceof RequestError) {
      validationResponse(res, error);
      return;
    }
    res.status(500).json({ error: "Unable to load users." });
  }
});

app.post("/api/admin/users", ...adminAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["name", "email", "role", "isActive", "initialPassword"]);
    for (const field of ["name", "email", "role", "isActive", "initialPassword"] as const) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) throw new RequestError(`${field} is required.`, field);
    }
    const name = adminName(body.name);
    const email = adminEmail(body.email);
    const role = adminRole(body.role);
    const isActive = adminActive(body.isActive);
    const initialPassword = adminPassword(body.initialPassword);
    if (!requireAllowedOrigin(req, res)) return;
    const user = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userAccountLockKey})`;
      const existing = await transaction.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw new EmailInUseError();
      const passwordHash = await hashPassword(initialPassword);
      try {
        return await transaction.user.create({
          data: { name, email, role, isActive, passwordHash, mustChangePassword: true },
          select: adminUserSelect,
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new EmailInUseError();
        throw error;
      }
    });
    noStore(res);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof EmailInUseError || isUniqueViolation(error)) {
      conflictWithField(res, "Email is already in use.", "EMAIL_IN_USE", "email");
      return;
    }
    if (error instanceof RequestError) {
      validationResponse(res, error);
      return;
    }
    res.status(500).json({ error: "Unable to create user." });
  }
});

app.patch("/api/admin/users/:userId", ...adminAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["name", "email", "role", "isActive"]);
    if (Object.keys(body).length === 0) throw new RequestError("At least one user field is required.");
    const userId = queryInteger(req.params.userId, "userId");
    const changes: Prisma.UserUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(body, "name")) changes.name = adminName(body.name);
    if (Object.prototype.hasOwnProperty.call(body, "email")) changes.email = adminEmail(body.email);
    if (Object.prototype.hasOwnProperty.call(body, "role")) changes.role = adminRole(body.role);
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) changes.isActive = adminActive(body.isActive);
    if (!requireAllowedOrigin(req, res)) return;
    const actor = authenticatedUser(req);
    const user = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userAccountLockKey})`;
      const current = await transaction.user.findUnique({ where: { id: userId }, select: { ...adminUserSelect } });
      if (!current) throw new UserNotFoundError();
      const nextRole = (changes.role as UserRole | undefined) ?? current.role;
      const nextIsActive = (changes.isActive as boolean | undefined) ?? current.isActive;
      const roleChanged = nextRole !== current.role;
      const deactivating = current.isActive && !nextIsActive;
      if (actor.id === current.id && deactivating) {
        throw new AdminSafetyConflictError("SELF_DEACTIVATION", "An Administrator cannot deactivate their own account.");
      }
      const removingActiveAdministrator = current.role === "ADMINISTRATOR" && current.isActive && (nextRole !== "ADMINISTRATOR" || !nextIsActive);
      if (removingActiveAdministrator && await transaction.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }) <= 1) {
        throw new AdminSafetyConflictError("LAST_ACTIVE_ADMINISTRATOR", "The last active Administrator cannot be removed.");
      }
      if ((roleChanged || deactivating) && await transaction.ticket.count({ where: { ownerId: userId } }) > 0) {
        throw new AdminSafetyConflictError("ASSIGNED_TICKET_OWNER", "Reassign this user's Tickets before changing their role or deactivating the account.");
      }
      const updated = await transaction.user.update({ where: { id: userId }, data: changes, select: adminUserSelect });
      if (roleChanged || deactivating) await transaction.session.deleteMany({ where: { userId } });
      return updated;
    });
    noStore(res);
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      notFound(res, "User not found.");
      return;
    }
    if (error instanceof AdminSafetyConflictError) {
      conflictWithCode(res, error.message, error.code);
      return;
    }
    if (error instanceof EmailInUseError || isUniqueViolation(error)) {
      conflictWithField(res, "Email is already in use.", "EMAIL_IN_USE", "email");
      return;
    }
    if (error instanceof RequestError) {
      validationResponse(res, error);
      return;
    }
    res.status(500).json({ error: "Unable to update user." });
  }
});

app.post("/api/admin/users/:userId/initial-password", ...adminAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["initialPassword"]);
    if (!Object.prototype.hasOwnProperty.call(body, "initialPassword")) throw new RequestError("initialPassword is required.", "initialPassword");
    const userId = queryInteger(req.params.userId, "userId");
    const initialPassword = adminPassword(body.initialPassword);
    if (!requireAllowedOrigin(req, res)) return;
    const actor = authenticatedUser(req);
    const user = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userAccountLockKey})`;
      const current = await transaction.user.findUnique({ where: { id: userId }, select: { ...adminUserSelect, passwordHash: true } });
      if (!current) throw new UserNotFoundError();
      if (await verifyPassword(current.passwordHash, initialPassword)) {
        throw new RequestError("New initial password must differ from the current password.", "initialPassword");
      }
      const passwordHash = await hashPassword(initialPassword);
      const updated = await transaction.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true }, select: adminUserSelect });
      await transaction.session.deleteMany({ where: { userId } });
      return updated;
    });
    if (actor.id === user.id) clearSessionCookie(res);
    noStore(res);
    res.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      notFound(res, "User not found.");
      return;
    }
    if (error instanceof RequestError) {
      validationResponse(res, error);
      return;
    }
    res.status(500).json({ error: "Unable to set initial password." });
  }
});

app.get("/api/categories", ...completedAuthentication, async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    noStore(res);
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Unable to load request categories." });
  }
});

app.get("/api/related-systems", ...completedAuthentication, async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    noStore(res);
    res.json(relatedSystems);
  } catch {
    res.status(500).json({ error: "Unable to load related systems." });
  }
});

app.get("/api/tickets", ...requesterAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, ["search", "categoryId", "requestedPriority", "status", "sortBy", "direction", "page", "pageSize"]);
    const requesterId = authenticatedUser(req).id;
    const categoryId = req.query.categoryId === undefined ? undefined : queryInteger(req.query.categoryId, "categoryId");
    const requestedPriority = req.query.requestedPriority === undefined ? undefined : queryChoice(req.query.requestedPriority, "requestedPriority", priorities, "MEDIUM");
    const status = req.query.status === undefined ? undefined : queryChoice(req.query.status, "status", statuses, "NEW");
    const sortBy = queryChoice(req.query.sortBy, "sortBy", sortFields, "updatedAt");
    const direction = queryChoice(req.query.direction, "direction", ["asc", "desc"] as const, "desc");
    const page = queryInteger(req.query.page, "page", 1);
    const pageSize = queryInteger(req.query.pageSize, "pageSize", 10);
    if (![5, 10, 20].includes(pageSize)) throw new RequestError("pageSize must be 5, 10, or 20.");
    const search = req.query.search === undefined ? undefined : typeof req.query.search === "string" ? req.query.search.trim() : (() => { throw new RequestError("search is invalid."); })();
    if (search !== undefined && search.length > 200) throw new RequestError("search must be no longer than 200 characters.");
    const where: Prisma.TicketWhereInput = { requesterId, categoryId, requestedPriority, status };
    if (search) where.OR = [{ ticketNumber: { contains: search, mode: "insensitive" } }, { summary: { contains: search, mode: "insensitive" } }];
    const prisma = getPrisma();
    const select = { id: true, ticketNumber: true, summary: true, requestedPriority: true, itPriority: true, status: true, createdAt: true, updatedAt: true, category: { select: { id: true, name: true } } } as const;
    const skip = (page - 1) * pageSize;
    const itemsPromise = sortBy === "requestedPriority"
      ? prisma.ticket.findMany({ where, orderBy: { id: direction }, select }).then((all) => all.sort((a, b) => comparePriority(a, b, direction)).slice(skip, skip + pageSize))
      : prisma.ticket.findMany({ where, orderBy: [{ [sortBy]: direction }, { id: direction }], skip, take: pageSize, select });
    const [items, totalItems] = await Promise.all([
      itemsPromise,
      prisma.ticket.count({ where }),
    ]);
    noStore(res);
    res.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load tickets." });
  }
});

app.get("/api/staff/tickets", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, ["search", "categoryId", "requestedPriority", "itPriority", "status", "ownership", "sortBy", "direction", "page", "pageSize"]);
    const user = authenticatedUser(req);
    const categoryId = req.query.categoryId === undefined ? undefined : queryInteger(req.query.categoryId, "categoryId");
    const requestedPriority = optionalQueryChoice(req.query.requestedPriority, "requestedPriority", priorities);
    const itPriority = optionalQueryChoice(req.query.itPriority, "itPriority", priorities);
    const status = optionalQueryChoice(req.query.status, "status", statuses);
    const ownership = queryChoice(req.query.ownership, "ownership", ownershipFilters, "all");
    const sortBy = queryChoice(req.query.sortBy, "sortBy", staffSortFields, "updatedAt");
    const direction = queryChoice(req.query.direction, "direction", ["asc", "desc"] as const, "desc");
    const page = queryInteger(req.query.page, "page", 1);
    const pageSize = queryInteger(req.query.pageSize, "pageSize", 10);
    if (![10, 20, 50].includes(pageSize)) throw new RequestError("pageSize must be 10, 20, or 50.");
    const skip = (page - 1) * pageSize;
    if (!Number.isSafeInteger(skip)) throw new RequestError("page is too large.");
    const search = req.query.search === undefined
      ? undefined
      : typeof req.query.search === "string"
        ? req.query.search.trim()
        : (() => { throw new RequestError("search is invalid."); })();
    if (search !== undefined && search.length > 200) throw new RequestError("search must be no longer than 200 characters.");

    const where: Prisma.TicketWhereInput = {
      categoryId,
      requestedPriority,
      itPriority,
      status,
      ...(ownership === "mine" ? { ownerId: user.id } : ownership === "assigned" ? { ownerId: { not: null } } : ownership === "unassigned" ? { ownerId: null } : {}),
    };
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { requester: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const select = {
      id: true,
      ticketNumber: true,
      summary: true,
      requestedPriority: true,
      itPriority: true,
      status: true,
      ownerId: true,
      resolutionIndicatedAt: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      requester: { select: personSelect },
      owner: { select: { id: true, name: true, role: true } },
    } as const;
    const prisma = getPrisma();
    const [allItems, totalItems] = await prisma.$transaction(async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.ticket.findMany({ where, orderBy: { id: "asc" }, select }),
        transaction.ticket.count({ where }),
      ]);
      return [items, total] as const;
    });
    const items = (allItems as StaffQueueRow[]).sort((a, b) => compareStaffQueue(a, b, sortBy, direction)).slice(skip, skip + pageSize);
    noStore(res);
    res.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load staff tickets." });
  }
});

app.get("/api/staff/tickets/:ticketId", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const detail = await loadStaffTicketDetail(getPrisma(), ticketId);
    noStore(res);
    res.json(detail);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load staff ticket." });
  }
});

app.post("/api/staff/tickets/:ticketId/claim", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    validateObject(req.body ?? {}, []);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!requireAllowedOrigin(req, res)) return;
    const user = authenticatedUser(req);
    const detail = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userAccountLockKey})`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId }, select: { id: true, ownerId: true } });
      if (!ticket) throw new TicketNotFoundError();
      const eligibleActor = await transaction.user.findFirst({
        where: { id: user.id, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
        select: { id: true },
      });
      if (!eligibleActor) throw new OwnerUnavailableError("The current staff account is no longer available.");
      if (ticket.ownerId !== null) throw new TicketAlreadyAssignedError();
      await transaction.ticket.update({ where: { id: ticketId }, data: { ownerId: user.id, updatedAt: new Date() } });
      return loadStaffTicketDetail(transaction, ticketId);
    });
    noStore(res);
    res.json(detail);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof TicketAlreadyAssignedError) {
      conflictWithCode(res, "This ticket is already assigned.", "TICKET_ALREADY_ASSIGNED");
      return;
    }
    if (error instanceof OwnerUnavailableError) {
      conflictWithCode(res, error.message, "OWNER_UNAVAILABLE");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to claim ticket." });
  }
});

app.patch("/api/staff/tickets/:ticketId/owner", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["ownerId"]);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!Object.prototype.hasOwnProperty.call(body, "ownerId")) throw new RequestError("ownerId is required.");
    const ownerId = body.ownerId === null ? null : requiredId(body.ownerId, "ownerId");
    if (!requireAllowedOrigin(req, res)) return;
    const detail = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userAccountLockKey})`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId }, select: { id: true, ownerId: true } });
      if (!ticket) throw new TicketNotFoundError();
      if (ticket.ownerId === ownerId) return loadStaffTicketDetail(transaction, ticketId);
      if (ownerId !== null) {
        const owner = await transaction.user.findFirst({
          where: { id: ownerId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
          select: { id: true },
        });
        if (!owner) throw new OwnerUnavailableError("The selected owner is unavailable.");
      }
      await transaction.ticket.update({ where: { id: ticketId }, data: { ownerId, updatedAt: new Date() } });
      return loadStaffTicketDetail(transaction, ticketId);
    });
    noStore(res);
    res.json(detail);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof OwnerUnavailableError) {
      conflictWithCode(res, error.message, "OWNER_UNAVAILABLE");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to update ticket owner." });
  }
});

app.patch("/api/staff/tickets/:ticketId/it-priority", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["itPriority"]);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!Object.prototype.hasOwnProperty.call(body, "itPriority")) throw new RequestError("itPriority is required.");
    const itPriority = requiredPriority(body.itPriority, "itPriority");
    if (!requireAllowedOrigin(req, res)) return;
    const detail = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId }, select: { id: true, itPriority: true } });
      if (!ticket) throw new TicketNotFoundError();
      if (ticket.itPriority !== itPriority) {
        await transaction.ticket.update({ where: { id: ticketId }, data: { itPriority, updatedAt: new Date() } });
      }
      return loadStaffTicketDetail(transaction, ticketId);
    });
    noStore(res);
    res.json(detail);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to update IT Priority." });
  }
});

app.patch("/api/staff/tickets/:ticketId/status", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["status"]);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!Object.prototype.hasOwnProperty.call(body, "status")) throw new RequestError("status is required.");
    const status = requiredStatus(body.status);
    if (!requireAllowedOrigin(req, res)) return;
    const detail = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId }, select: { id: true, status: true } });
      if (!ticket) throw new TicketNotFoundError();
      if (!allowedStatusTransitions[ticket.status as typeof statuses[number]].includes(status)) throw new InvalidStatusTransitionError();
      const data = status === "REOPENED"
        ? { status, resolutionIndicatedAt: null, updatedAt: new Date() }
        : { status, updatedAt: new Date() };
      await transaction.ticket.update({ where: { id: ticketId }, data });
      return loadStaffTicketDetail(transaction, ticketId);
    });
    noStore(res);
    res.json(detail);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof InvalidStatusTransitionError) {
      conflictWithCode(res, "That status transition is not permitted.", "INVALID_STATUS_TRANSITION");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to update ticket status." });
  }
});

app.get("/api/staff/tickets/:ticketId/internal-notes", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) {
      notFound(res, "Ticket not found.");
      return;
    }
    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: personSelect } },
    });
    noStore(res);
    res.json(notes.map(internalNoteDto));
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load internal notes." });
  }
});

app.post("/api/staff/tickets/:ticketId/internal-notes", ...staffAuthentication, async (req: Request, res: Response) => {
  try {
    const body = validateObject(req.body ?? {}, ["body"]);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const content = requiredText(body.body, "body", 1, 4_000);
    if (!requireAllowedOrigin(req, res)) return;
    const user = authenticatedUser(req);
    const note = await getPrisma().$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) throw new TicketNotFoundError();
      const created = await transaction.internalNote.create({
        data: { ticketId, authorId: user.id, content },
        select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: personSelect } },
      });
      await transaction.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return created;
    });
    noStore(res);
    res.status(201).json(internalNoteDto(note));
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to add internal note." });
  }
});

app.get("/api/tickets/:ticketId", ...requesterAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const requesterId = authenticatedUser(req).id;
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: { id: true, ticketNumber: true, requesterId: true, categoryId: true, relatedSystemId: true, summary: true, description: true, requestedPriority: true, itPriority: true, status: true, ownerId: true, resolutionIndicatedAt: true, createdAt: true, updatedAt: true, requester: { select: personSelect }, owner: { select: { id: true, name: true, role: true } }, category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } }, attachments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: attachmentSelect } },
    });
    if (!ticket) {
      notFound(res, "Ticket not found.");
      return;
    }
    noStore(res);
    res.json(ticket);
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load ticket." });
  }
});

app.post("/api/tickets/:ticketId/attachments", ...requesterAuthentication, upload.single("file"), async (req: Request, res: Response) => {
  let storageKey: string | null = null;
  try {
    validateObject(req.body ?? {}, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!req.file || req.file.originalname.length === 0 || req.file.originalname.length > 255) throw new RequestError("Attachment filename is invalid.");
    const file = req.file;
    if (!hasAttachmentSignature(file)) throw new AttachmentTypeError();
    if (!requireAllowedOrigin(req, res)) return;
    const prisma = getPrisma();
    const requesterId = authenticatedUser(req).id;
    const attachment = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;
      const ticket = await transaction.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
      if (!ticket) throw new TicketNotFoundError();
      if (await transaction.attachment.count({ where: { ticketId, removedAt: null } }) >= 5) throw new AttachmentLimitError();
      storageKey = randomUUID();
      await saveAttachment(storageKey, file.buffer);
      const created = await transaction.attachment.create({ data: { ticketId, originalName: file.originalname, storageKey, mimeType: file.mimetype, sizeBytes: file.size }, select: attachmentSelect });
      await transaction.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return created;
    });
    noStore(res);
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

app.get("/api/attachments/:attachmentId", ...completedAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const prisma = getPrisma();
    const user = authenticatedUser(req);
    const attachment = await prisma.attachment.findFirst({ where: user.role === "REQUESTER" ? { id: attachmentId, ticket: { requesterId: user.id } } : { id: attachmentId }, select: attachmentSelect });
    if (!attachment) {
      notFound(res, "Attachment not found.");
      return;
    }
    noStore(res);
    res.json(attachment);
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load attachment." });
  }
});

app.get("/api/attachments/:attachmentId/download", ...completedAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const prisma = getPrisma();
    const user = authenticatedUser(req);
    const attachment = await prisma.attachment.findFirst({ where: user.role === "REQUESTER" ? { id: attachmentId, removedAt: null, ticket: { requesterId: user.id } } : { id: attachmentId, removedAt: null }, select: { originalName: true, mimeType: true, storageKey: true } });
    if (!attachment) {
      notFound(res, "Attachment not found.");
      return;
    }
    noStore(res);
    res.set("X-Content-Type-Options", "nosniff").type(attachment.mimeType).download(attachmentPath(attachment.storageKey), attachment.originalName, (error) => {
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

app.delete("/api/attachments/:attachmentId", ...requesterAuthentication, async (req: Request, res: Response) => {
  try {
    validateObject(req.body ?? {}, ["reason"]);
    const attachmentId = queryInteger(req.params.attachmentId, "attachmentId");
    const reason = requiredText(req.body?.reason, "reason", 1, 500);
    if (!requireAllowedOrigin(req, res)) return;
    const prisma = getPrisma();
    const requesterId = authenticatedUser(req).id;
    const removed = await prisma.$transaction(async (transaction) => {
      const attachment = await transaction.attachment.findFirst({ where: { id: attachmentId, removedAt: null, ticket: { requesterId } }, select: { id: true, ticketId: true } });
      if (!attachment) throw new TicketNotFoundError();
      const updated = await transaction.attachment.update({ where: { id: attachmentId }, data: { removedAt: new Date(), removalReason: reason }, select: attachmentSelect });
      await transaction.ticket.update({ where: { id: attachment.ticketId }, data: { updatedAt: new Date() } });
      return updated;
    });
    noStore(res);
    res.json(removed);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Attachment not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to remove attachment." });
  }
});

app.get("/api/tickets/:ticketId/public-comments", ...completedAuthentication, async (req: Request, res: Response) => {
  try {
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const prisma = getPrisma();
    if (!await findReadableTicket(prisma, ticketId, req)) {
      notFound(res, "Ticket not found.");
      return;
    }
    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: personSelect } },
    });
    noStore(res);
    res.json(comments.map(publicCommentDto));
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to load public comments." });
  }
});

app.post("/api/tickets/:ticketId/public-comments", ...completedAuthentication, async (req: Request, res: Response) => {
  try {
    validateObject(req.body ?? {}, ["body"]);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    const body = requiredText(req.body?.body, "body", 1, 2_000);
    if (!requireAllowedOrigin(req, res)) return;
    const prisma = getPrisma();
    const user = authenticatedUser(req);
    const comment = await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findFirst({
        where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
        select: { id: true },
      });
      if (!ticket) throw new TicketNotFoundError();
      const created = await transaction.publicComment.create({
        data: { ticketId, authorId: user.id, content: body },
        select: { id: true, ticketId: true, content: true, createdAt: true, author: { select: personSelect } },
      });
      await transaction.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return created;
    });
    noStore(res);
    res.status(201).json(publicCommentDto(comment));
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to add public comment." });
  }
});

app.post("/api/tickets/:ticketId/resolution-indication", ...requesterAuthentication, async (req: Request, res: Response) => {
  try {
    validateObject(req.body ?? {}, []);
    validateQuery(req.query as Record<string, unknown>, []);
    const ticketId = queryInteger(req.params.ticketId, "ticketId");
    if (!requireAllowedOrigin(req, res)) return;
    const prisma = getPrisma();
    const user = authenticatedUser(req);
    const allowedStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
    const result = await prisma.$transaction(async (transaction) => {
      // The conditional update is the first-writer-wins guard. A concurrent
      // request may read the same null value, but only one updateMany can
      // claim the still-null row; the loser re-reads and returns that value.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const ticket = await transaction.ticket.findFirst({
          where: { id: ticketId, requesterId: user.id },
          select: { id: true, status: true, resolutionIndicatedAt: true, updatedAt: true },
        });
        if (!ticket) throw new TicketNotFoundError();
        if (!allowedStatuses.includes(ticket.status as typeof allowedStatuses[number])) throw new ResolutionConflictError();
        if (ticket.resolutionIndicatedAt) return { ticketId: ticket.id, resolutionIndicatedAt: ticket.resolutionIndicatedAt, status: ticket.status, updatedAt: ticket.updatedAt };

        const now = new Date();
        const claimed = await transaction.ticket.updateMany({
          where: { id: ticketId, requesterId: user.id, resolutionIndicatedAt: null, status: { in: [...allowedStatuses] } },
          data: { resolutionIndicatedAt: now, updatedAt: now },
        });
        if (claimed.count === 1) {
          return { ticketId: ticket.id, resolutionIndicatedAt: now, status: ticket.status, updatedAt: now };
        }
      }
      throw new Error("Resolution indication could not be recorded.");
    });
    noStore(res);
    res.json(result);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      notFound(res, "Ticket not found.");
      return;
    }
    if (error instanceof ResolutionConflictError) {
      conflict(res, "Resolution indication is not available for this ticket status.");
      return;
    }
    if (error instanceof RequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unable to record resolution indication." });
  }
});

app.post("/api/tickets", ...requesterAuthentication, async (req: Request, res: Response) => {
  try {
    validateObject(req.body ?? {}, ["categoryId", "relatedSystemId", "requestedPriority", "summary", "description"]);
    const requesterId = authenticatedUser(req).id;
    if (!requireAllowedOrigin(req, res)) return;
    const categoryId = requiredId(req.body?.categoryId, "categoryId");
    const relatedSystemId = requiredId(req.body?.relatedSystemId, "relatedSystemId");
    const summary = requiredText(req.body?.summary, "summary", 5, 200);
    const description = requiredText(req.body?.description, "description", 10, 4_000);
    const priority = requestedPriority(req.body?.requestedPriority);
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { id: relatedSystemId, isActive: true }, select: { id: true } }),
    ]);

    if (!category || !relatedSystem) throw new RequestError("Reference data is unavailable.");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: generateTicketNumber(), requesterId, categoryId, relatedSystemId,
            requestedPriority: priority, itPriority: priority, status: "NEW", summary, description,
          },
        });
        noStore(res);
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

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found.", code: "NOT_FOUND" });
    return;
  }
  next();
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
