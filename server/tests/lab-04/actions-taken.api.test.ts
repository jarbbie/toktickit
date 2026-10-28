import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { hashSessionToken } from "../../src/auth.js";
import { setPrismaForTests } from "../../src/prisma.js";
import { applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const origin = "http://localhost:5173";
const migrations = ["20260809101008_init", "20260825000000_lab2_ticketing", "20260918000000_lab3_data_foundation", "20261028000000_lab4_data_foundation"];
const input = { actionAt: "2026-10-29T09:30:00+07:00", description: " Inspect service. ", followUpRequired: false, expectedWorkflowVersion: 1 };

async function setup(prisma: PrismaClient) {
  for (const migration of migrations) await applyMigration(prisma, migration);
  const users = await Promise.all([
    prisma.user.create({ data: { name: "Staff", email: "staff@test.local", role: "IT_STAFF", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Admin", email: "admin@test.local", role: "ADMINISTRATOR", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Requester", email: "requester@test.local", role: "REQUESTER", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Other", email: "other@test.local", role: "REQUESTER", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Inactive", email: "inactive@test.local", role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
  ]);
  const cookies: string[] = [];
  for (const user of users) {
    const token = randomUUID();
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    cookies.push(`toktickit_session=${token}`);
  }
  const category = await prisma.category.create({ data: { name: "Hardware" } });
  const system = await prisma.relatedSystem.create({ data: { name: "Service" } });
  const ticket = await prisma.ticket.create({ data: { ticketNumber: "TKT-ACTIONS", summary: "Service fails", description: "Investigate service failure", requesterId: users[2].id, ownerId: users[1].id, categoryId: category.id, relatedSystemId: system.id, status: "OPEN" } });
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
function create(f: Fixture, body: object = input, key: string = randomUUID(), cookie = f.cookies[0]) {
  return request(app).post(`/api/staff/tickets/${f.ticket.id}/actions`).set("Origin", origin).set("Cookie", cookie).set("Idempotency-Key", key).send(body);
}
function patch(f: Fixture, id: number, suffix: string, body: object) {
  return request(app).patch(`/api/staff/actions/${id}${suffix}`).set("Origin", origin).set("Cookie", f.cookies[0]).send(body);
}
async function state(f: Fixture) {
  return { ticket: await f.prisma.ticket.findUnique({ where: { id: f.ticket.id } }), actions: await f.prisma.actionTaken.findMany({ include: { events: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } }) };
}

describe.skipIf(!testDatabaseEnabled)("Actions Taken API on PostgreSQL", () => {
  it("creates a normalized Action with the session performer, safe DTO and atomic audit/version updates", async () => {
    await withApi(async (f) => {
      const detail = await request(app).get(`/api/staff/tickets/${f.ticket.id}`).set("Cookie", f.cookies[0]);
      expect(detail.body.workflowVersion).toBe(1);
      const res = await create(f, { ...input, assigneeId: f.users[1].id });
      expect(res.status).toBe(201);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toMatchObject({ ticketId: f.ticket.id, actionAt: "2026-10-29T02:30:00.000Z", description: "Inspect service.", performedBy: { id: f.users[0].id, role: "IT_STAFF" }, assignee: { id: f.users[1].id }, status: "PLANNED", result: null, version: 1 });
      expect(res.body).not.toHaveProperty("creationFingerprint");
      expect(res.body).not.toHaveProperty("idempotencyKey");
      expect(res.body).not.toHaveProperty("events");
      const saved = await state(f);
      expect(saved.ticket?.workflowVersion).toBe(2);
      expect(saved.ticket!.updatedAt.getTime()).toBeGreaterThan(f.ticket.updatedAt.getTime());
      expect(saved.actions[0].events).toHaveLength(1);
      expect(saved.actions[0].events[0]).toMatchObject({ actorId: f.users[0].id, type: "CREATED", before: null });
      expect(saved.actions[0].events[0].after).not.toHaveProperty("creationFingerprint");
    });
  });

  it("enforces session, password, role and Origin gates before writes", async () => {
    await withApi(async (f) => {
      expect((await create(f, input, randomUUID(), "")).status).toBe(401);
      expect((await create(f, input, randomUUID(), f.cookies[2])).status).toBe(403);
      expect((await create(f, input, randomUUID(), f.cookies[4])).status).toBe(401);
      const foreign = await request(app).post(`/api/staff/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[0]).set("Idempotency-Key", randomUUID()).send(input);
      expect(foreign.status).toBe(403);
      await f.prisma.user.update({ where: { id: f.users[0].id }, data: { mustChangePassword: true } });
      expect((await create(f)).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      expect(await f.prisma.actionTaken.count()).toBe(0);
    });
  });

  it("conceals foreign Tickets and exposes ordered current fields only to Requesters", async () => {
    await withApi(async (f) => {
      expect((await request(app).get(`/api/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[2])).body).toEqual([]);
      const a = await create(f, { ...input, actionAt: "2026-10-28T01:00:00Z" });
      const b = await create(f, { ...input, actionAt: "2026-10-27T01:00:00Z", expectedWorkflowVersion: 2 });
      const c = await create(f, { ...input, actionAt: "2026-10-27T01:00:00Z", expectedWorkflowVersion: 3 });
      const requesterRead = await request(app).get(`/api/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[2]);
      expect(requesterRead.status).toBe(200);
      expect(requesterRead.body.map((row: { id: number }) => row.id)).toEqual([b.body.id, c.body.id, a.body.id]);
      expect(requesterRead.body.every((row: object) => !("events" in row))).toBe(true);
      expect(JSON.stringify(requesterRead.body)).not.toMatch(/email|Fingerprint|idempotency|password|Internal/);
      const read = await request(app).get(`/api/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[1]);
      expect(read.body[0].events[0]).toMatchObject({ type: "CREATED", actor: { id: f.users[0].id } });
      const hidden = await request(app).get(`/api/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[3]);
      const missing = await request(app).get("/api/tickets/2147483647/actions").set("Cookie", f.cookies[3]);
      expect(hidden.status).toBe(404);
      expect(hidden.body).toEqual(missing.body);
    });
  });

  it("serializes same-key creates and rejects different actor, Ticket or content reuse without writes", async () => {
    await withApi(async (f) => {
      const key = randomUUID();
      const results = await Promise.all([create(f, input, key), create(f, input, key)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
      expect(results.find((r) => r.status === 200)?.headers["idempotent-replayed"]).toBe("true");
      const before = await state(f);
      expect((await create(f, { ...input, description: "Different" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
      expect((await create(f, input, key, f.cookies[1])).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
      const otherTicket = await f.prisma.ticket.create({ data: { ...f.ticket, id: undefined, ticketNumber: "OTHER" } });
      const reused = await request(app).post(`/api/staff/tickets/${otherTicket.id}/actions`).set("Origin", origin).set("Cookie", f.cookies[0]).set("Idempotency-Key", key).send(input);
      expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(await state(f)).toEqual(before);
    });
  });

  it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)("blocks all writes on %s parents but permits exact create replay", async (status) => {
    await withApi(async (f) => {
      const key = randomUUID();
      const created = await create(f, input, key);
      expect(created.status).toBe(201);
      await f.prisma.ticket.update({ where: { id: f.ticket.id }, data: { status } });
      const before = await state(f);
      const replay = await create(f, input, key);
      expect(replay.status).toBe(200);
      expect(replay.headers["idempotent-replayed"]).toBe("true");
      const rejected = [
        await create(f, { ...input, expectedWorkflowVersion: 2 }),
        await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, description: "Edit" }),
        await patch(f, created.body.id, "/assignee", { expectedVersion: 1, expectedWorkflowVersion: 2, assigneeId: f.users[1].id }),
        await patch(f, created.body.id, "/status", { expectedVersion: 1, expectedWorkflowVersion: 2, status: "IN_PROGRESS" }),
      ];
      for (const res of rejected) { expect(res.status).toBe(409); expect(res.body.code).toBe("ACTION_TICKET_NOT_MUTABLE"); }
      expect(await state(f)).toEqual(before);
      if (status !== "CANCELLED") {
        await f.prisma.ticket.update({ where: { id: f.ticket.id }, data: { status: "REOPENED" } });
        expect((await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, description: "Correction" })).status).toBe(200);
      }
    });
  });

  it("validates fields, explicit-offset calendar dates, key, identities and missing versions without writes", async () => {
    await withApi(async (f) => {
      const invalid = [
        { ...input, description: " " }, { ...input, description: "x".repeat(2001) },
        { ...input, actionAt: "2026-02-30T09:00:00Z" }, { ...input, actionAt: "2026-10-29T09:00:00" },
        { ...input, followUpRequired: "false" }, { ...input, followUpRequired: true },
        { ...input, attachmentNotes: "x".repeat(1001) }, { ...input, performerId: f.users[1].id },
        { ...input, performedById: f.users[1].id }, { ...input, result: "Forged initial result" },
        { ...input, assigneeId: "1" }, { ...input, expectedWorkflowVersion: "1" },
      ];
      for (const body of invalid) expect((await create(f, body)).status).toBe(400);
      expect((await create(f, input, "invalid-key")).status).toBe(400);
      const { expectedWorkflowVersion, ...missing } = input;
      expect((await create(f, missing)).body.code).toBe("STALE_TICKET_WORKFLOW");
      expect(await f.prisma.actionTaken.count()).toBe(0);
      expect((await state(f)).ticket?.workflowVersion).toBe(1);
    });
  });

  it("validates assignees, supports Admin writes, and treats same-assignee writes as read-only", async () => {
    await withApi(async (f) => {
      for (const id of [f.users[2].id, f.users[4].id, 2147483647]) {
        expect((await create(f, { ...input, assigneeId: id })).body.code).toBe("ACTION_ASSIGNEE_UNAVAILABLE");
      }
      const created = await create(f, { ...input, assigneeId: f.users[0].id }, randomUUID(), f.cookies[1]);
      expect(created.status).toBe(201);
      expect(created.body.performedBy.id).toBe(f.users[1].id);
      const before = await state(f);
      expect((await patch(f, created.body.id, "/assignee", { expectedVersion: 1, expectedWorkflowVersion: 2, assigneeId: f.users[0].id })).status).toBe(200);
      expect(await state(f)).toEqual(before);
      expect((await patch(f, created.body.id, "/assignee", { expectedVersion: 1, expectedWorkflowVersion: 2, assigneeId: f.users[2].id })).body.code).toBe("ACTION_ASSIGNEE_UNAVAILABLE");
      const assigned = await patch(f, created.body.id, "/assignee", { expectedVersion: 1, expectedWorkflowVersion: 2, assigneeId: f.users[1].id });
      expect(assigned.body).toMatchObject({ version: 2, assignee: { id: f.users[1].id }, performedBy: { id: f.users[1].id } });
      const unassigned = await patch(f, created.body.id, "/assignee", { expectedVersion: 2, expectedWorkflowVersion: 3, assigneeId: null });
      expect(unassigned.body).toMatchObject({ version: 3, assignee: null });
      expect((await state(f)).actions[0].events.map((e) => e.type)).toEqual(["CREATED", "ASSIGNED", "ASSIGNED"]);
    });
  });

  it("edits resulting follow-up state, clears notes and preserves chronological snapshots", async () => {
    await withApi(async (f) => {
      const created = await create(f, { ...input, followUpRequired: true, followUpNote: " Call tomorrow " });
      expect(created.status).toBe(201);
      const invalid = await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, followUpNote: "" });
      expect(invalid.status).toBe(400);
      const edited = await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, followUpRequired: false, attachmentNotes: " plain <text> " });
      expect(edited.body).toMatchObject({ followUpNote: null, version: 2, attachmentNotes: "plain <text>" });
      const events = (await state(f)).actions[0].events;
      expect(events[1]).toMatchObject({ type: "EDITED", before: { followUpNote: "Call tomorrow" }, after: { followUpNote: null } });
      const tiedAt = new Date("2026-10-29T03:00:00Z");
      // Equal event times exercise the deterministic ID tie-breaker on reads.
      // Insert-only fixture setup respects the append-only audit trigger.
      await f.prisma.actionEvent.createMany({ data: [0, 1].map(() => ({ actionId: created.body.id, actorId: f.users[0].id, type: "EDITED" as const, before: {}, after: {}, createdAt: tiedAt })) });
      const read = await request(app).get(`/api/tickets/${f.ticket.id}/actions`).set("Cookie", f.cookies[0]);
      const ordered = await f.prisma.actionEvent.findMany({ where: { actionId: created.body.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      expect(read.body[0].events.map((e: { id: number }) => e.id)).toEqual(ordered.map((e) => e.id));
    });
  });

  it("enforces lifecycle transitions and completion results while permitting audited terminal text corrections", async () => {
    await withApi(async (f) => {
      const created = await create(f);
      const id = created.body.id;
      expect((await patch(f, id, "/status", { expectedVersion: 1, expectedWorkflowVersion: 2, status: "COMPLETED" })).status).toBe(400);
      expect((await patch(f, id, "/status", { expectedVersion: 1, expectedWorkflowVersion: 2, status: "IN_PROGRESS" })).body.version).toBe(2);
      const beforeRepeat = await state(f);
      expect((await patch(f, id, "/status", { expectedVersion: 2, expectedWorkflowVersion: 3, status: "IN_PROGRESS" })).body.code).toBe("INVALID_ACTION_TRANSITION");
      expect(await state(f)).toEqual(beforeRepeat);
      expect((await patch(f, id, "/status", { expectedVersion: 2, expectedWorkflowVersion: 3, status: "COMPLETED", result: " Fixed " })).body).toMatchObject({ status: "COMPLETED", result: "Fixed", version: 3 });
      expect((await patch(f, id, "/assignee", { expectedVersion: 3, expectedWorkflowVersion: 4, assigneeId: null })).body.code).toBe("ACTION_TERMINAL");
      expect((await patch(f, id, "", { expectedVersion: 3, expectedWorkflowVersion: 4, result: null })).status).toBe(400);
      expect((await patch(f, id, "", { expectedVersion: 3, expectedWorkflowVersion: 4, description: "Corrected record" })).body.version).toBe(4);
      expect((await patch(f, id, "/status", { expectedVersion: 4, expectedWorkflowVersion: 5, status: "CANCELLED" })).body.code).toBe("INVALID_ACTION_TRANSITION");
      const planned = await create(f, { ...input, expectedWorkflowVersion: 5 });
      const cancelled = await patch(f, planned.body.id, "/status", { expectedVersion: 1, expectedWorkflowVersion: 6, status: "CANCELLED" });
      expect(cancelled.body.status).toBe("CANCELLED");
    });
  });

  it("serializes concurrent writes to a Ticket and rejects stale or missing versions without mutation", async () => {
    await withApi(async (f) => {
      const created = await create(f);
      const id = created.body.id;
      const responses = await Promise.all(["First", "Second"].map((description) => patch(f, id, "", { description, expectedVersion: 1, expectedWorkflowVersion: 2 })));
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const before = await state(f);
      expect((await patch(f, id, "", { description: "Stale action", expectedVersion: 1, expectedWorkflowVersion: 3 })).body.code).toBe("STALE_ACTION");
      expect((await patch(f, id, "", { description: "Missing workflow", expectedVersion: 2 })).body.code).toBe("STALE_TICKET_WORKFLOW");
      expect((await patch(f, id, "", { description: "Missing action version", expectedWorkflowVersion: 3 })).body.code).toBe("STALE_ACTION");
      expect(await state(f)).toEqual(before);
      const creates = await Promise.all([create(f, { ...input, expectedWorkflowVersion: 3 }), create(f, { ...input, expectedWorkflowVersion: 3 })]);
      expect(creates.map((r) => r.status).sort()).toEqual([201, 409]);
      expect((await state(f)).ticket?.workflowVersion).toBe(4);
    });
  });

  it("rolls back Action, event and parent changes on an audit failure and returns a safe error", async () => {
    await withApi(async (f) => {
      const created = await create(f);
      await f.prisma.$executeRawUnsafe(`CREATE FUNCTION fail_action_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'sensitive SQL internals'; END; $$ LANGUAGE plpgsql`);
      await f.prisma.$executeRawUnsafe(`CREATE TRIGGER fail_action_audit BEFORE INSERT ON "ActionEvent" FOR EACH ROW EXECUTE FUNCTION fail_action_audit()`);
      const before = await state(f);
      const failed = await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, description: "Must roll back" });
      expect(failed.status).toBe(500);
      expect(JSON.stringify(failed.body)).not.toMatch(/sensitive|SQL|prisma|stack/);
      expect(await state(f)).toEqual(before);
      const failedCreate = await create(f, { ...input, expectedWorkflowVersion: 2 });
      expect(failedCreate.status).toBe(500);
      expect(await state(f)).toEqual(before);
    });
  });

  it("supports browser idempotency headers and rejects malformed requests and missing resources safely", async () => {
    await withApi(async (f) => {
      const preflight = await request(app).options(`/api/staff/tickets/${f.ticket.id}/actions`).set("Origin", origin).set("Access-Control-Request-Method", "POST").set("Access-Control-Request-Headers", "content-type,idempotency-key");
      expect(preflight.status).toBe(204);
      expect(preflight.headers["access-control-allow-headers"].toLowerCase()).toContain("idempotency-key");
      const malformed = await request(app).post(`/api/staff/tickets/${f.ticket.id}/actions`).set("Origin", origin).set("Cookie", f.cookies[0]).set("Content-Type", "application/json").send("{");
      expect(malformed.status).toBe(400);
      expect(malformed.headers["cache-control"]).toBe("no-store");
      const unknownTicket = await request(app).post("/api/staff/tickets/2147483647/actions").set("Origin", origin).set("Cookie", f.cookies[0]).set("Idempotency-Key", randomUUID()).send(input);
      expect(unknownTicket.status).toBe(404);
      for (const suffix of ["", "/assignee", "/status"]) {
        const denied = await request(app).patch(`/api/staff/actions/2147483647${suffix}`).set("Origin", origin).set("Cookie", f.cookies[2]).send({});
        expect(denied.status).toBe(403);
        expect((await patch(f, 2147483647, suffix, { expectedVersion: 1, expectedWorkflowVersion: 1, ...(suffix === "" ? { description: "Edit" } : suffix === "/status" ? { status: "IN_PROGRESS" } : { assigneeId: null }) })).status).toBe(404);
      }
      for (const path of ["0", "-1", "1.5", "2147483648", "abc"]) {
        expect((await request(app).get(`/api/tickets/${path}/actions`).set("Cookie", f.cookies[0])).status).toBe(400);
      }
      const created = await create(f);
      const before = await state(f);
      expect((await patch(f, created.body.id, "", { expectedVersion: 1, expectedWorkflowVersion: 2, actorId: f.users[1].id })).status).toBe(400);
      expect((await request(app).get(`/api/tickets/${f.ticket.id}/actions?requesterId=${f.users[3].id}`).set("Cookie", f.cookies[0])).status).toBe(400);
      expect((await request(app).post(`/api/staff/tickets/${f.ticket.id}/actions`).set("Origin", origin).set("Cookie", f.cookies[0]).send({ ...input, expectedWorkflowVersion: 2 })).status).toBe(400);
      expect(await state(f)).toEqual(before);
    });
  });

  it("enforces every Action lifecycle transition pair", async () => {
    await withApi(async (f) => {
      const matrix = { PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
      for (const current of ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) {
        for (const target of ["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) {
          let workflow = (await state(f)).ticket!.workflowVersion;
          let action = (await create(f, { ...input, expectedWorkflowVersion: workflow })).body;
          workflow++;
          if (current !== "PLANNED") {
            const initial = await patch(f, action.id, "/status", { expectedVersion: action.version, expectedWorkflowVersion: workflow, status: current, ...(current === "COMPLETED" ? { result: "Verified" } : {}) });
            expect(initial.status).toBe(200);
            action = initial.body;
            workflow++;
          }
          const before = await state(f);
          const res = await patch(f, action.id, "/status", { expectedVersion: action.version, expectedWorkflowVersion: workflow, status: target, ...(target === "COMPLETED" ? { result: "Verified" } : {}) });
          if ((matrix[current] as readonly string[]).includes(target)) {
            expect(res.status).toBe(200);
            expect(res.body.status).toBe(target);
          } else {
            expect(res.status).toBe(409);
            expect(res.body.code).toBe("INVALID_ACTION_TRANSITION");
            expect(await state(f)).toEqual(before);
          }
        }
      }
    });
  });
});
