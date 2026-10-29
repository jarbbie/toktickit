import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { withDashboardApi, testDatabaseEnabled } from "./dashboard-test-utils.js";

function windowStartFor(asOf: string) {
  const instant = new Date(asOf);
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate() - 6) - 7 * 60 * 60 * 1000).toISOString();
}

describe.skipIf(!testDatabaseEnabled)("Requester dashboard API on PostgreSQL", () => {
  it("calculates owned counts and recent lists from status history in the Bangkok calendar window", async () => {
    await withDashboardApi(async (f) => {
      const now = Date.now();
      const recent = (seconds: number) => new Date(now - 60 * 60 * 1000 + seconds * 1000);
      const old = new Date(now - 8 * 24 * 60 * 60 * 1000);
      const ownOpen = await Promise.all([
        f.ticket({ status: "NEW", updatedAt: recent(1) }),
        f.ticket({ status: "OPEN", updatedAt: recent(2) }),
        f.ticket({ status: "IN_PROGRESS", updatedAt: recent(3) }),
        f.ticket({ status: "WAITING_FOR_REQUESTER", updatedAt: recent(4) }),
        f.ticket({ status: "REOPENED", updatedAt: recent(5) }),
        f.ticket({ status: "NEW", updatedAt: old }),
      ]);
      const recentResolved = await f.ticket({ status: "CLOSED", updatedAt: recent(0) });
      const legacyResolved = await f.ticket({ status: "RESOLVED", updatedAt: recent(-1) });
      const oldResolved = await f.ticket({ status: "CLOSED", updatedAt: old });
      await f.statusEvent(recentResolved.id, "OPEN", "RESOLVED", recent(-10));
      await f.statusEvent(recentResolved.id, "RESOLVED", "CLOSED", recent(-9));
      await f.statusEvent(oldResolved.id, "OPEN", "RESOLVED", old);
      await f.ticket({ requesterId: f.users.otherRequester.id, status: "OPEN", updatedAt: recent(30) });

      const response = await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies.requester);

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.asOf).toEqual(expect.any(String));
      expect(response.body.windowStart).toBe(windowStartFor(response.body.asOf));
      expect(response.body.counts).toEqual({
        openTickets: { count: 6, href: "/tickets?statusGroup=open" },
        waitingForRequester: { count: 1, href: "/tickets?status=WAITING_FOR_REQUESTER" },
        recentlyResolved: { count: 1, href: expect.stringContaining("/tickets?statusGroup=resolved&resolvedAfter=") },
      });
      expect(response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id)).toEqual(ownOpen.slice(0, 5).map((ticket) => ticket.id).reverse());
      expect(response.body.recentlyUpdated).toHaveLength(5);
      expect(response.body.recentlyResolvedTickets).toEqual([expect.objectContaining({
        id: recentResolved.id,
        resolvedAt: recent(-10).toISOString(),
        href: `/tickets/${recentResolved.id}`,
      })]);
      expect(response.body.recentlyResolvedTickets.some((ticket: { id: number }) => ticket.id === legacyResolved.id || ticket.id === oldResolved.id)).toBe(false);
      expect(JSON.stringify(response.body)).not.toMatch(/email|owner|requesterId|password|session/i);
    });
  });

  it("applies the documented list groups, inclusive dates, latest resolution time, and safe role/query failures", async () => {
    await withDashboardApi(async (f) => {
      const now = Date.now();
      const boundary = new Date(now - 60_000);
      const includedOpen = await f.ticket({ status: "OPEN", updatedAt: boundary });
      await f.ticket({ status: "NEW", updatedAt: new Date(boundary.getTime() - 1) });
      await f.ticket({ requesterId: f.users.otherRequester.id, status: "OPEN", updatedAt: boundary });
      const firstResolved = await f.ticket({ status: "CLOSED", updatedAt: new Date(now - 10_000) });
      const secondResolved = await f.ticket({ status: "RESOLVED", updatedAt: new Date(now - 20_000) });
      const legacyResolved = await f.ticket({ status: "RESOLVED", updatedAt: new Date(now - 30_000) });
      const olderEvent = new Date(now - 2 * 60 * 60 * 1000);
      const latestEvent = new Date(now - 10 * 60 * 1000);
      await f.statusEvent(firstResolved.id, "OPEN", "RESOLVED", olderEvent);
      await f.statusEvent(firstResolved.id, "RESOLVED", "REOPENED", new Date(olderEvent.getTime() + 1_000));
      await f.statusEvent(firstResolved.id, "REOPENED", "RESOLVED", latestEvent);
      await f.statusEvent(secondResolved.id, "OPEN", "RESOLVED", new Date(now - 20 * 60 * 1000));

      const updated = await request(app).get(`/api/tickets?statusGroup=open&updatedAfter=${encodeURIComponent(boundary.toISOString())}`).set("Cookie", f.cookies.requester);
      expect(updated.status).toBe(200);
      expect(updated.body.items.map((ticket: { id: number }) => ticket.id)).toContain(includedOpen.id);
      expect(updated.body.items).toHaveLength(1);

      const resolved = await request(app).get(`/api/tickets?statusGroup=resolved&resolvedAfter=${encodeURIComponent(latestEvent.toISOString())}&sortBy=resolvedAt&direction=desc`).set("Cookie", f.cookies.requester);
      expect(resolved.status).toBe(200);
      expect(resolved.body.items).toHaveLength(1);
      expect(resolved.body.items[0]).toMatchObject({ id: firstResolved.id, resolvedAt: latestEvent.toISOString() });

      const allResolved = await request(app).get("/api/tickets?statusGroup=resolved&sortBy=resolvedAt&direction=desc").set("Cookie", f.cookies.requester);
      expect(allResolved.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([firstResolved.id, secondResolved.id, legacyResolved.id]);
      expect(allResolved.body.items.at(-1).resolvedAt).toBeNull();

      for (const query of [
        "?statusGroup=open&status=NEW",
        "?resolvedAfter=2026-10-01T00:00:00Z",
        "?statusGroup=resolved&resolvedAfter=not-a-date",
        "?statusGroup=open&statusGroup=resolved",
        "?sortBy=resolvedAt",
      ]) {
        const invalid = await request(app).get(`/api/tickets${query}`).set("Cookie", f.cookies.requester);
        expect(invalid.status).toBe(400);
        expect(invalid.headers["cache-control"]).toBe("no-store");
      }
      const forbidden = await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies.staff);
      const unauthenticated = await request(app).get("/api/requester/dashboard");
      const extraQuery = await request(app).get("/api/requester/dashboard?ignored=1").set("Cookie", f.cookies.requester);
      expect(forbidden.status).toBe(403);
      expect(forbidden.headers["cache-control"]).toBe("no-store");
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.headers["cache-control"]).toBe("no-store");
      expect(extraQuery.status).toBe(400);
      expect(extraQuery.headers["cache-control"]).toBe("no-store");
    });
  });

  it("returns explicit zero results and a safe no-store response when dashboard data fails", async () => {
    await withDashboardApi(async (f) => {
      const empty = await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies.requester);
      expect(empty.status).toBe(200);
      expect(empty.body.counts.openTickets.count).toBe(0);
      expect(empty.body.counts.waitingForRequester.count).toBe(0);
      expect(empty.body.counts.recentlyResolved.count).toBe(0);
      expect(empty.body.recentlyUpdated).toEqual([]);
      expect(empty.body.recentlyResolvedTickets).toEqual([]);

      await f.prisma.$executeRawUnsafe('ALTER TABLE "TicketStatusEvent" RENAME TO "TicketStatusEvent_unavailable"');
      let failed;
      try {
        failed = await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies.requester);
      } finally {
        await f.prisma.$executeRawUnsafe('ALTER TABLE "TicketStatusEvent_unavailable" RENAME TO "TicketStatusEvent"');
      }
      expect(failed.status).toBe(500);
      expect(failed.headers["cache-control"]).toBe("no-store");
      expect(failed.body).toEqual({ error: "Unable to load Requester dashboard." });
    });
  });
});
