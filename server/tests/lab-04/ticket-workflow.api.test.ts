import type { PrismaClient, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { hashSessionToken } from "../../src/auth.js";
import { setPrismaForTests } from "../../src/prisma.js";
import { applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const origin = "http://localhost:5173";
const migrations = ["20260809101008_init", "20260825000000_lab2_ticketing", "20260918000000_lab3_data_foundation", "20261028000000_lab4_data_foundation"];
const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const allowed: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

async function setup(prisma: PrismaClient) {
  for (const migration of migrations) await applyMigration(prisma, migration);
  const users = await Promise.all([
    prisma.user.create({ data: { name: "Staff", email: "workflow.staff@test.local", role: "IT_STAFF", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Admin", email: "workflow.admin@test.local", role: "ADMINISTRATOR", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Requester", email: "workflow.requester@test.local", role: "REQUESTER", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Other requester", email: "workflow.other@test.local", role: "REQUESTER", mustChangePassword: false } }),
  ]);
  const cookies: string[] = [];
  for (const user of users) {
    const token = randomUUID();
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    cookies.push(`toktickit_session=${token}`);
  }
  const category = await prisma.category.create({ data: { name: "Workflow Hardware" } });
  const system = await prisma.relatedSystem.create({ data: { name: "Workflow Service" } });
  let sequence = 0;
  async function ticket(status: TicketStatus, requesterId = users[2].id) {
    sequence += 1;
    return prisma.ticket.create({ data: {
      ticketNumber: `WF-${randomUUID().slice(0, 8)}-${sequence}`,
      summary: "Workflow regression case", description: "Ticket used by workflow API tests.",
      requesterId, categoryId: category.id, relatedSystemId: system.id, status,
    } });
  }
  return { prisma, users, cookies, ticket };
}
type Fixture = Awaited<ReturnType<typeof setup>>;

async function withApi(run: (fixture: Fixture) => Promise<void>) {
  await withIsolatedSchema(async (prisma) => {
    const fixture = await setup(prisma);
    setPrismaForTests(prisma);
    try { await run(fixture); } finally { setPrismaForTests(null); }
  });
}

function transition(fixture: Fixture, ticketId: number, status: TicketStatus, expectedWorkflowVersion: number | undefined, cookie = fixture.cookies[0]) {
  const body = expectedWorkflowVersion === undefined ? { status } : { status, expectedWorkflowVersion };
  return request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Origin", origin).set("Cookie", cookie).send(body);
}

async function addCompletedAction(fixture: Fixture, ticketId: number, followUpRequired = false) {
  return fixture.prisma.actionTaken.create({ data: {
    ticketId, actionAt: new Date("2026-10-29T02:30:00Z"), description: "Completed workflow action",
    result: "Service restored", performedById: fixture.users[0].id, status: "COMPLETED",
    followUpRequired, followUpNote: followUpRequired ? "Confirm after one day" : null,
    idempotencyKey: randomUUID(), creationFingerprint: "a".repeat(64),
  } });
}

describe.skipIf(!testDatabaseEnabled)("Ticket workflow API on PostgreSQL", () => {
  it("enforces every transition pair and rejects Requester writes", async () => {
    await withApi(async (f) => {
      for (const fromStatus of statuses) {
        for (const toStatus of statuses) {
          const ticket = await f.ticket(fromStatus);
          if (toStatus === "RESOLVED") await addCompletedAction(f, ticket.id);
          const result = await transition(f, ticket.id, toStatus, 1);
          if (allowed[fromStatus].includes(toStatus)) {
            expect(result.status, `${fromStatus} -> ${toStatus}`).toBe(200);
            expect(result.body).toMatchObject({ status: toStatus, workflowVersion: 2 });
            const events = await f.prisma.ticketStatusEvent.findMany({ where: { ticketId: ticket.id } });
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({ fromStatus, toStatus, actorId: f.users[0].id });
          } else {
            expect(result.status, `${fromStatus} -> ${toStatus}`).toBe(409);
            expect(result.body.code).toBe("INVALID_STATUS_TRANSITION");
            expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
            expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).workflowVersion).toBe(1);
          }
        }
      }

      const requesterTicket = await f.ticket("OPEN");
      const forbidden = await transition(f, requesterTicket.id, "IN_PROGRESS", 1, f.cookies[2]);
      expect(forbidden.status).toBe(403);
      expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: requesterTicket.id } })).toBe(0);
    });
  });

  it("requires a current workflow version and records status, actor, time, and stable history", async () => {
    await withApi(async (f) => {
      const ticket = await f.ticket("OPEN");
      const missingVersion = await transition(f, ticket.id, "IN_PROGRESS", undefined);
      expect(missingVersion.status).toBe(409);
      expect(missingVersion.body.code).toBe("STALE_TICKET_WORKFLOW");
      const malformedVersion = await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("Cookie", f.cookies[0]).send({ status: "IN_PROGRESS", expectedWorkflowVersion: "1" });
      expect(malformedVersion.status).toBe(400);

      const first = await transition(f, ticket.id, "IN_PROGRESS", 1);
      const second = await transition(f, ticket.id, "WAITING_FOR_REQUESTER", 2, f.cookies[1]);
      expect([first.status, second.status]).toEqual([200, 200]);
      const events = await f.prisma.ticketStatusEvent.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } });
      expect(events.map((event) => [event.fromStatus, event.toStatus, event.actorId])).toEqual([
        ["OPEN", "IN_PROGRESS", f.users[0].id],
        ["IN_PROGRESS", "WAITING_FOR_REQUESTER", f.users[1].id],
      ]);
      expect(events[1].changedAt.getTime()).toBeGreaterThanOrEqual(events[0].changedAt.getTime());
      expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).workflowVersion).toBe(3);
    });
  });

  it("blocks resolution and cancellation gates atomically and permits resolution after work is complete", async () => {
    await withApi(async (f) => {
      const ticket = await f.ticket("OPEN");
      const noCompletedAction = await transition(f, ticket.id, "RESOLVED", 1);
      expect(noCompletedAction.status).toBe(409);
      expect(noCompletedAction.body).toMatchObject({ code: "RESOLUTION_BLOCKED", details: { completedActions: 0, activeActions: 0, followUpActions: 0 } });

      await f.prisma.actionTaken.create({ data: {
        ticketId: ticket.id, actionAt: new Date(), description: "Active support work", performedById: f.users[0].id,
        followUpRequired: true, followUpNote: "Confirm tomorrow", idempotencyKey: randomUUID(), creationFingerprint: "b".repeat(64),
      } });
      const before = await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const blockedResolve = await transition(f, ticket.id, "RESOLVED", 1);
      const blockedCancel = await transition(f, ticket.id, "CANCELLED", 1);
      expect(blockedResolve.body).toMatchObject({ code: "RESOLUTION_BLOCKED", details: { activeActions: 1, followUpActions: 1 } });
      expect(blockedCancel.body).toMatchObject({ code: "CANCELLATION_BLOCKED", details: { activeActions: 1 } });
      expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
      const after = await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect({ status: after.status, workflowVersion: after.workflowVersion, updatedAt: after.updatedAt }).toEqual({ status: before.status, workflowVersion: before.workflowVersion, updatedAt: before.updatedAt });

      const completable = await f.ticket("OPEN");
      await addCompletedAction(f, completable.id);
      const resolved = await transition(f, completable.id, "RESOLVED", 1);
      expect(resolved.status).toBe(200);
      expect(resolved.body).toMatchObject({ status: "RESOLVED", workflowVersion: 2 });
    });
  });

  it("clears advisory resolution on reopen and serializes competing stale transitions", async () => {
    await withApi(async (f) => {
      const resolved = await f.ticket("RESOLVED");
      await f.prisma.ticket.update({ where: { id: resolved.id }, data: { resolutionIndicatedAt: new Date("2026-10-28T00:00:00Z") } });
      const reopened = await transition(f, resolved.id, "REOPENED", 1);
      expect(reopened.status).toBe(200);
      expect(reopened.body.resolutionIndicatedAt).toBeNull();
      expect(reopened.body.workflowVersion).toBe(2);

      const concurrent = await f.ticket("OPEN");
      const responses = await Promise.all([
        transition(f, concurrent.id, "IN_PROGRESS", 1),
        transition(f, concurrent.id, "WAITING_FOR_REQUESTER", 1, f.cookies[1]),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(responses.find((response) => response.status === 409)?.body.code).toBe("STALE_TICKET_WORKFLOW");
      expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: concurrent.id } })).toBe(1);
    });
  });

  it("serializes Action creation against Ticket resolution with the shared lock and workflow version", async () => {
    await withApi(async (f) => {
      const ticket = await f.ticket("OPEN");
      await addCompletedAction(f, ticket.id);
      const key = randomUUID();
      const [resolution, creation] = await Promise.all([
        transition(f, ticket.id, "RESOLVED", 1),
        request(app).post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", origin).set("Cookie", f.cookies[0]).set("Idempotency-Key", key).send({
          actionAt: "2026-10-29T09:30:00+07:00", description: "Concurrent follow-up work", followUpRequired: false, expectedWorkflowVersion: 1,
        }),
      ]);

      expect(resolution.status === 200 || creation.status === 201).toBe(true);
      expect([resolution.status, creation.status].filter((status) => status === 409)).toHaveLength(1);
      const savedTicket = await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const actions = await f.prisma.actionTaken.findMany({ where: { ticketId: ticket.id } });
      if (savedTicket.status === "RESOLVED") {
        expect(resolution.status).toBe(200);
        expect(creation.status).toBe(409);
        expect(actions.every((action) => action.status === "COMPLETED")).toBe(true);
      } else {
        expect(savedTicket.status).toBe("OPEN");
        expect(resolution.status).toBe(409);
        expect(creation.status).toBe(201);
        expect(actions.some((action) => action.status === "PLANNED")).toBe(true);
      }
      expect(savedTicket.workflowVersion).toBe(2);
      expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(savedTicket.status === "RESOLVED" ? 1 : 0);
    });
  });

  it("exposes only safe ordered status history to support and the owning Requester", async () => {
    await withApi(async (f) => {
      const ticket = await f.ticket("OPEN");
      const sharedTime = new Date("2026-10-29T01:00:00Z");
      await f.prisma.ticketStatusEvent.createMany({ data: [
        { ticketId: ticket.id, fromStatus: "OPEN", toStatus: "IN_PROGRESS", actorId: f.users[0].id, changedAt: sharedTime },
        { ticketId: ticket.id, fromStatus: "IN_PROGRESS", toStatus: "WAITING_FOR_REQUESTER", actorId: f.users[1].id, changedAt: sharedTime },
      ] });
      const requester = await request(app).get(`/api/tickets/${ticket.id}/status-events`).set("Cookie", f.cookies[2]);
      expect(requester.status).toBe(200);
      expect(requester.headers["cache-control"]).toContain("no-store");
      expect(requester.body.map((event: { id: number }) => event.id)).toEqual([...(await f.prisma.ticketStatusEvent.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } })).map((event) => event.id)]);
      expect(requester.body).toMatchObject([
        { fromStatus: "OPEN", toStatus: "IN_PROGRESS", actor: { id: f.users[0].id, role: "IT_STAFF" }, changedAt: sharedTime.toISOString() },
        { fromStatus: "IN_PROGRESS", toStatus: "WAITING_FOR_REQUESTER", actor: { id: f.users[1].id, role: "ADMINISTRATOR" }, changedAt: sharedTime.toISOString() },
      ]);
      expect(JSON.stringify(requester.body)).not.toMatch(/email|password|internal|storage/i);

      const foreign = await request(app).get(`/api/tickets/${ticket.id}/status-events`).set("Cookie", f.cookies[3]);
      const missing = await request(app).get("/api/tickets/2147483647/status-events").set("Cookie", f.cookies[3]);
      const unauthenticated = await request(app).get(`/api/tickets/${ticket.id}/status-events`);
      const support = await request(app).get(`/api/tickets/${ticket.id}/status-events`).set("Cookie", f.cookies[0]);
      expect(foreign.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
      expect(unauthenticated.status).toBe(401);
      expect(support.status).toBe(200);
    });
  });
});
