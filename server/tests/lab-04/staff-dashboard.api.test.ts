import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../../src/app.js";
import { withDashboardApi, testDatabaseEnabled } from "./dashboard-test-utils.js";

const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

describe.skipIf(!testDatabaseEnabled)("Staff dashboard API on PostgreSQL", () => {
  it("returns authoritative counts, scoped summaries, recent work, and urgency ordering for Staff and Admin", async () => {
    await withDashboardApi(async (f) => {
      const now = Date.now();
      const ago = (milliseconds: number) => new Date(now - milliseconds);
      const fixtureTickets = [
        await f.ticket({ status: "NEW", itPriority: "LOW", updatedAt: ago(60 * 60 * 1000) }),
        await f.ticket({ status: "OPEN", itPriority: "HIGH", ownerId: f.users.staff.id, updatedAt: ago(2 * 60 * 60 * 1000) }),
        await f.ticket({ status: "IN_PROGRESS", itPriority: "URGENT", ownerId: f.users.otherStaff.id, updatedAt: ago(4 * 60 * 60 * 1000) }),
        await f.ticket({ status: "WAITING_FOR_REQUESTER", itPriority: "MEDIUM", updatedAt: ago(8 * 24 * 60 * 60 * 1000) }),
        await f.ticket({ status: "RESOLVED", itPriority: "URGENT", updatedAt: ago(10 * 60 * 1000) }),
        await f.ticket({ status: "CLOSED", itPriority: "LOW", ownerId: f.users.staff.id, updatedAt: ago(10 * 60 * 1000) }),
        await f.ticket({ status: "REOPENED", itPriority: "HIGH", ownerId: f.users.admin.id, updatedAt: ago(5 * 60 * 60 * 1000) }),
        await f.ticket({ status: "CANCELLED", itPriority: "HIGH", updatedAt: ago(10 * 60 * 1000) }),
      ];
      const ownActions = [];
      const ownActionDates = [ago(30 * 24 * 60 * 60 * 1000), ago(2 * 60 * 1000), ago(2 * 60 * 1000), ago(3 * 60 * 1000), ago(4 * 60 * 1000), ago(5 * 60 * 1000)];
      for (const [index, actionAt] of ownActionDates.entries()) {
        ownActions.push(await f.prisma.actionTaken.create({ data: {
          ticketId: fixtureTickets[index % fixtureTickets.length].id,
          actionAt,
          description: `Action by dashboard staff ${index + 1}`,
          performedById: f.users.staff.id,
          assigneeId: index % 2 === 0 ? f.users.otherStaff.id : f.users.staff.id,
          status: index === 0 ? "COMPLETED" : "PLANNED",
          result: index === 0 ? "The completed work was verified." : null,
          idempotencyKey: randomUUID(),
          creationFingerprint: "a".repeat(64),
        } }));
      }
      await f.prisma.actionTaken.create({ data: {
        ticketId: fixtureTickets[0].id,
        actionAt: ago(60 * 1000),
        description: "Assigned to dashboard staff but performed by another staff member",
        performedById: f.users.otherStaff.id,
        assigneeId: f.users.staff.id,
        idempotencyKey: randomUUID(),
        creationFingerprint: "b".repeat(64),
      } });
      await f.prisma.actionTaken.create({ data: {
        ticketId: fixtureTickets[1].id,
        actionAt: ago(60 * 1000),
        description: "Action by administrator",
        performedById: f.users.admin.id,
        idempotencyKey: randomUUID(),
        creationFingerprint: "c".repeat(64),
      } });
      const databaseActionCount = await f.prisma.actionTaken.count({ where: { performedById: f.users.staff.id } });
      const response = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies.staff);

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.asOf).toEqual(expect.any(String));
      expect(response.body.windowStart).toEqual(expect.any(String));
      expect(response.body.counts.unassignedOpen).toEqual({ count: 2, href: "/staff/tickets?statusGroup=open&ownership=unassigned" });
      expect(response.body.counts.ownedByMeOpen).toEqual({ count: 1, href: "/staff/tickets?statusGroup=open&ownership=mine" });
      expect(response.body.counts.byStatus.map((row: { status: string; count: number }) => [row.status, row.count])).toEqual(statuses.map((status) => [status, 1]));
      expect(response.body.counts.byStatus.every((row: { href: string }) => row.href.startsWith("/staff/tickets?status="))).toBe(true);
      expect(response.body.counts.byITPriority.map((row: { itPriority: string; count: number }) => [row.itPriority, row.count])).toEqual([
        ["LOW", 1], ["MEDIUM", 1], ["HIGH", 2], ["URGENT", 1],
      ]);
      expect(response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id)).toEqual([
        fixtureTickets[0].id, fixtureTickets[1].id, fixtureTickets[2].id, fixtureTickets[6].id,
      ]);
      expect(response.body.urgentTickets.map((ticket: { id: number }) => ticket.id)).toEqual([
        fixtureTickets[2].id, fixtureTickets[6].id, fixtureTickets[1].id,
      ]);
      expect(response.body.urgentTickets[0].href).toBe(`/staff/tickets/${fixtureTickets[2].id}`);
      expect(response.body.urgentTickets[0].requester).toEqual({ id: f.users.requester.id, name: f.users.requester.name });
      expect(response.body.urgentTickets[0].owner).toEqual({ id: f.users.otherStaff.id, name: f.users.otherStaff.name, role: "IT_STAFF" });
      expect(JSON.stringify(response.body)).not.toContain(f.users.requester.email);
      expect(databaseActionCount).toBe(6);
      expect(response.body.myActionsTaken.count).toBe(databaseActionCount);
      expect(response.body.myActionsTaken.recent.map((action: { id: number }) => action.id)).toEqual(
        [...ownActions].sort((a, b) => b.actionAt.getTime() - a.actionAt.getTime() || b.id - a.id).slice(0, 5).map((action) => action.id),
      );
      expect(response.body.myActionsTaken.recent[0]).toMatchObject({
        ticketId: fixtureTickets[2].id,
        ticketNumber: fixtureTickets[2].ticketNumber,
        summary: fixtureTickets[2].summary,
        description: "Action by dashboard staff 3",
        status: "PLANNED",
        href: `/staff/tickets/${fixtureTickets[2].id}`,
      });
      expect(response.body.myActionsTaken.recent).toHaveLength(5);

      const admin = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies.admin);
      expect(admin.status).toBe(200);
      expect(admin.body.counts).toEqual(response.body.counts);
      expect(admin.body.urgentTickets).toEqual(response.body.urgentTickets);
      expect(admin.body.myActionsTaken.count).toBe(1);
      expect(admin.body.myActionsTaken.recent[0].description).toBe("Action by administrator");
    });
  });

  it("matches Queue drill-down populations and enforces supported filters and authorization", async () => {
    await withDashboardApi(async (f) => {
      const now = Date.now();
      const threshold = new Date(now - 60 * 60 * 1000);
      const unassignedAtBoundary = await f.ticket({ status: "OPEN", itPriority: "URGENT", updatedAt: threshold });
      const unassignedWaiting = await f.ticket({ status: "WAITING_FOR_REQUESTER", itPriority: "MEDIUM", updatedAt: new Date(now - 8 * 24 * 60 * 60 * 1000) });
      const myHigh = await f.ticket({ status: "NEW", itPriority: "HIGH", ownerId: f.users.staff.id, updatedAt: new Date(now - 30 * 60 * 1000) });
      const urgentOld = await f.ticket({ status: "REOPENED", itPriority: "URGENT", ownerId: f.users.otherStaff.id, updatedAt: new Date(now - 4 * 60 * 60 * 1000) });
      const highOld = await f.ticket({ status: "OPEN", itPriority: "HIGH", ownerId: f.users.staff.id, updatedAt: new Date(now - 5 * 60 * 60 * 1000) });
      await f.ticket({ status: "RESOLVED", itPriority: "URGENT", updatedAt: threshold });

      const unassigned = await request(app).get("/api/staff/tickets?statusGroup=open&ownership=unassigned").set("Cookie", f.cookies.staff);
      expect(unassigned.status).toBe(200);
      expect(unassigned.body.items.map((ticket: { id: number }) => ticket.id).sort((a: number, b: number) => a - b)).toEqual([unassignedAtBoundary.id, unassignedWaiting.id].sort((a, b) => a - b));

      const updated = await request(app).get(`/api/staff/tickets?statusGroup=open&updatedAfter=${encodeURIComponent(threshold.toISOString())}`).set("Cookie", f.cookies.staff);
      expect(updated.status).toBe(200);
      expect(updated.body.items.map((ticket: { id: number }) => ticket.id)).toContain(unassignedAtBoundary.id);
      expect(updated.body.items.some((ticket: { id: number }) => ticket.id === unassignedWaiting.id)).toBe(false);

      const urgentWork = await request(app).get("/api/staff/tickets?statusGroup=open&itPriorityGroup=high_or_urgent&sortBy=urgentWork").set("Cookie", f.cookies.staff);
      expect(urgentWork.status).toBe(200);
      expect(urgentWork.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([urgentOld.id, unassignedAtBoundary.id, highOld.id, myHigh.id]);

      for (const query of [
        "?statusGroup=resolved",
        "?statusGroup=open&status=NEW",
        "?itPriorityGroup=high_or_urgent&itPriority=HIGH",
        "?statusGroup=open&updatedAfter=2026-02-30T00:00:00Z",
        "?statusGroup=open&statusGroup=open",
        "?sortBy=urgentWork",
      ]) {
        const invalid = await request(app).get(`/api/staff/tickets${query}`).set("Cookie", f.cookies.staff);
        expect(invalid.status).toBe(400);
        expect(invalid.headers["cache-control"]).toBe("no-store");
      }
      const forbidden = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies.requester);
      const unauthenticated = await request(app).get("/api/staff/dashboard");
      const extraQuery = await request(app).get("/api/staff/dashboard?ignored=1").set("Cookie", f.cookies.staff);
      expect(forbidden.status).toBe(403);
      expect(forbidden.headers["cache-control"]).toBe("no-store");
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.headers["cache-control"]).toBe("no-store");
      expect(extraQuery.status).toBe(400);
      expect(extraQuery.headers["cache-control"]).toBe("no-store");
    });
  });

  it("returns zero counts and empty operational lists when no Tickets exist", async () => {
    await withDashboardApi(async (f) => {
      const response = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies.staff);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.counts.unassignedOpen.count).toBe(0);
      expect(response.body.counts.ownedByMeOpen.count).toBe(0);
      expect(response.body.counts.byStatus.map((row: { count: number }) => row.count)).toEqual(Array(8).fill(0));
      expect(response.body.counts.byITPriority.map((row: { count: number }) => row.count)).toEqual(Array(4).fill(0));
      expect(response.body.recentlyUpdated).toEqual([]);
      expect(response.body.urgentTickets).toEqual([]);
      expect(response.body.myActionsTaken).toEqual({ count: 0, recent: [] });
    });
  });
});
