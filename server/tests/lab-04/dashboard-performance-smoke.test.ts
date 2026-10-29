import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { withDashboardApi, testDatabaseEnabled } from "./dashboard-test-utils.js";

const ticketStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function p95(samples: number[]) {
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1];
}

describe.skipIf(!testDatabaseEnabled)("Dashboard performance smoke on PostgreSQL", () => {
  it("keeps 1,000 Ticket and 5,000 Action dashboard reads summary-only under 500 ms p95", async () => {
    await withDashboardApi(async (fixture) => {
      const sample = await fixture.ticket();
      const baseTime = Date.now();
      await fixture.prisma.ticket.createMany({
        data: Array.from({ length: 999 }, (_, index) => ({
          ticketNumber: `PERF-${String(index + 1).padStart(8, "0")}`,
          requesterId: index % 2 ? fixture.users.requester.id : fixture.users.otherRequester.id,
          ownerId: index % 3 ? fixture.users.staff.id : null,
          categoryId: sample.categoryId,
          relatedSystemId: sample.relatedSystemId,
          requestedPriority: priorities[index % priorities.length],
          itPriority: priorities[(index * 3) % priorities.length],
          status: ticketStatuses[index % ticketStatuses.length],
          summary: `Dashboard smoke ticket ${index + 1}`,
          description: "Synthetic data for the local dashboard performance smoke check.",
          createdAt: new Date(baseTime - index * 1000),
          updatedAt: new Date(baseTime - index * 1000),
        })),
      });

      const ticketIds = await fixture.prisma.ticket.findMany({ orderBy: { id: "asc" }, select: { id: true } });
      expect(ticketIds).toHaveLength(1000);
      await fixture.prisma.actionTaken.createMany({
        data: ticketIds.flatMap(({ id: ticketId }) => Array.from({ length: 5 }, (_, actionIndex) => ({
          ticketId,
          actionAt: new Date(baseTime - actionIndex * 60_000),
          description: `Performance smoke Action ${actionIndex + 1}`,
          performedById: fixture.users.staff.id,
          assigneeId: fixture.users.staff.id,
          idempotencyKey: randomUUID(),
          creationFingerprint: "a".repeat(64),
        }))),
      });

      const requesterPath = "/api/requester/dashboard";
      const staffPath = "/api/staff/dashboard";
      const requester = () => request(app).get(requesterPath).set("Cookie", fixture.cookies.requester);
      const staff = () => request(app).get(staffPath).set("Cookie", fixture.cookies.staff);
      const requesterWarmup = await requester();
      const staffWarmup = await staff();
      expect(requesterWarmup.status).toBe(200);
      expect(staffWarmup.status).toBe(200);

      const measure = async (read: () => Promise<request.Response>) => {
        const elapsed: number[] = [];
        for (let index = 0; index < 20; index += 1) {
          const start = performance.now();
          const response = await read();
          elapsed.push(performance.now() - start);
          expect(response.status).toBe(200);
        }
        return elapsed;
      };
      const [requesterTimes, staffTimes] = await Promise.all([measure(requester), measure(staff)]);

      expect(requesterWarmup.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
      expect(requesterWarmup.body.recentlyResolvedTickets.length).toBeLessThanOrEqual(5);
      expect(staffWarmup.body.recentlyUpdated.length).toBeLessThanOrEqual(10);
      expect(staffWarmup.body.urgentTickets.length).toBeLessThanOrEqual(5);
      for (const row of [...requesterWarmup.body.recentlyUpdated, ...staffWarmup.body.recentlyUpdated, ...staffWarmup.body.urgentTickets]) {
        expect(row).not.toHaveProperty("description");
      }

      const requesterP95 = p95(requesterTimes);
      const staffP95 = p95(staffTimes);
      console.info(`[dashboard-performance-smoke] node=${process.version} tickets=${ticketIds.length} actions=${ticketIds.length * 5} warmedReads=20 requesterP95Ms=${requesterP95.toFixed(1)} staffP95Ms=${staffP95.toFixed(1)}`);
      expect(requesterP95).toBeLessThan(500);
      expect(staffP95).toBeLessThan(500);
    },);
  }, 120_000);
});
