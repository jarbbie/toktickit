import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  actionFallbackTicketFixture,
  actionFixtures,
  categories,
  lab4DashboardUsers,
  recentResolvedActionFixture,
  recentResolvedTicketFixture,
  relatedSystems,
  requesters,
  seedDatabase,
  staffUsers,
  ticketFixtures,
} from "../../prisma/seed-data.js";
import { applyLab3Baseline, applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const migrations = [
  "20260809101008_init",
  "20260825000000_lab2_ticketing",
  "20260918000000_lab3_data_foundation",
  "20261028000000_lab4_data_foundation",
];

async function runSeed(prisma: PrismaClient) {
  await prisma.$transaction((transaction) => seedDatabase(transaction), { timeout: 60_000 });
}

describe.skipIf(!testDatabaseEnabled)("Lab 4 PostgreSQL seed", () => {
  it("supports a clean install, dashboard zero/non-zero cases, and repeat-safe sample Actions", async () => {
    await withIsolatedSchema(async (prisma) => {
      for (const migration of migrations) await applyMigration(prisma, migration);
      await runSeed(prisma);

      const seededTickets = await prisma.ticket.findMany({
        where: { ticketNumber: { in: ticketFixtures.map(({ ticketNumber }) => ticketNumber) } },
        select: { ticketNumber: true, status: true, requestedPriority: true, itPriority: true, ownerId: true },
      });
      expect(seededTickets).toHaveLength(24);
      expect(new Set(seededTickets.map(({ status }) => status))).toEqual(new Set([
        "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
      ]));
      expect(new Set(seededTickets.map(({ requestedPriority }) => requestedPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]));
      expect(new Set(seededTickets.map(({ itPriority }) => itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]));
      expect(seededTickets.some(({ ownerId }) => ownerId === null)).toBe(true);
      expect(seededTickets.some(({ ownerId }) => ownerId !== null)).toBe(true);

      const actionRows = await prisma.actionTaken.findMany({
        include: { ticket: { select: { ticketNumber: true } } },
        orderBy: [{ ticketId: "asc" }, { actionAt: "asc" }, { id: "asc" }],
      });
      expect(actionRows).toHaveLength(actionFixtures.length + 1);
      expect(new Set(actionRows.map(({ status }) => status))).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
      const actionCounts = new Map<string, number>();
      for (const action of actionRows) actionCounts.set(action.ticket.ticketNumber, (actionCounts.get(action.ticket.ticketNumber) ?? 0) + 1);
      expect(actionCounts.get(ticketFixtures[0].ticketNumber)).toBe(2);
      expect(actionCounts.get(ticketFixtures[1].ticketNumber)).toBe(1);
      expect(actionCounts.get(recentResolvedTicketFixture.ticketNumber)).toBe(1);
      expect(actionCounts.get(ticketFixtures[3].ticketNumber) ?? 0).toBe(0);
      expect(await prisma.actionEvent.count()).toBeGreaterThanOrEqual(actionFixtures.length);

      const actionEvent = await prisma.actionEvent.findFirstOrThrow();
      const statusEvent = await prisma.ticketStatusEvent.findFirstOrThrow();
      await expect(prisma.$executeRaw`UPDATE "ActionTaken" SET status = 'COMPLETED', result = NULL WHERE id = ${actionRows[0].id}`).rejects.toThrow(/ActionTaken_completion_result_check/);
      await expect(prisma.$executeRaw`UPDATE "ActionEvent" SET "createdAt" = CURRENT_TIMESTAMP WHERE id = ${actionEvent.id}`).rejects.toThrow(/append-only/);
      await expect(prisma.$executeRaw`DELETE FROM "TicketStatusEvent" WHERE id = ${statusEvent.id}`).rejects.toThrow(/append-only/);
      await expect(prisma.$executeRaw`TRUNCATE TABLE "ActionEvent"`).rejects.toThrow(/append-only/);
      await expect(prisma.$executeRaw`TRUNCATE TABLE "TicketStatusEvent"`).rejects.toThrow(/append-only/);

      const recentResolved = await prisma.ticket.findUniqueOrThrow({
        where: { ticketNumber: recentResolvedTicketFixture.ticketNumber },
        select: { id: true, status: true, workflowVersion: true, createdAt: true, updatedAt: true },
      });
      expect(recentResolved).toMatchObject({ status: "RESOLVED", workflowVersion: 4 });
      const resolutionAction = await prisma.actionTaken.findUniqueOrThrow({
        where: { idempotencyKey: recentResolvedActionFixture.key },
      });
      expect(resolutionAction).toMatchObject({
        ticketId: recentResolved.id,
        status: "COMPLETED",
        followUpRequired: false,
      });
      expect(await prisma.actionTaken.count({ where: { ticketId: recentResolved.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } })).toBe(0);
      expect(await prisma.actionTaken.count({ where: { ticketId: recentResolved.id, followUpRequired: true } })).toBe(0);
      expect(await prisma.ticketStatusEvent.count({ where: { ticketId: recentResolved.id, toStatus: "RESOLVED" } })).toBe(1);
      const resolutionEvent = await prisma.ticketStatusEvent.findFirstOrThrow({
        where: { ticketId: recentResolved.id, toStatus: "RESOLVED" },
        select: { changedAt: true },
      });
      expect(recentResolved.updatedAt.getTime()).toBeGreaterThanOrEqual(resolutionEvent.changedAt.getTime());

      for (const [fixtureIndex, expectedVersion] of [[0, 4], [1, 3], [2, 3], [3, 1]] as const) {
        const ticket = await prisma.ticket.findUniqueOrThrow({
          where: { ticketNumber: ticketFixtures[fixtureIndex].ticketNumber },
          select: { id: true, workflowVersion: true, createdAt: true, updatedAt: true },
        });
        expect(ticket.workflowVersion).toBe(expectedVersion);
        const actionsOnTicket = actionRows.filter(({ ticketId }) => ticketId === ticket.id);
        if (actionsOnTicket.length > 0) {
          const latestEvent = await prisma.actionEvent.findFirstOrThrow({
            where: { actionId: { in: actionsOnTicket.map(({ id }) => id) } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { createdAt: true },
          });
          expect(ticket.updatedAt.getTime()).toBeGreaterThanOrEqual(latestEvent.createdAt.getTime());
        }
      }

      const emptyRequester = await prisma.user.findUniqueOrThrow({
        where: { email: lab4DashboardUsers[0].email },
        select: { id: true },
      });
      const unownedStaff = await prisma.user.findUniqueOrThrow({
        where: { email: lab4DashboardUsers[1].email },
        select: { id: true },
      });
      expect(await prisma.ticket.count({ where: { requesterId: emptyRequester.id } })).toBe(0);
      expect(await prisma.ticket.count({ where: { ownerId: unownedStaff.id } })).toBe(0);

      const seededTicket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: ticketFixtures[0].ticketNumber }, select: { id: true } });
      const seededComment = await prisma.publicComment.findFirstOrThrow({ where: { ticketId: seededTicket.id } });
      const seededNote = await prisma.internalNote.findFirstOrThrow({ where: { ticketId: seededTicket.id } });
      const unmanagedPasswordlessUser = await prisma.user.create({ data: { name: "Unmanaged account", email: "unmanaged.passwordless@toktickit.test" } });
      const countsBefore = {
        users: await prisma.user.count(),
        tickets: await prisma.ticket.count(),
        actions: await prisma.actionTaken.count(),
        actionEvents: await prisma.actionEvent.count(),
        statusEvents: await prisma.ticketStatusEvent.count(),
        comments: await prisma.publicComment.count(),
        notes: await prisma.internalNote.count(),
      };
      const adminBefore = await prisma.user.findUniqueOrThrow({ where: { email: "admin@toktickit.test" }, select: { passwordHash: true } });
      const editedAction = await prisma.actionTaken.findUniqueOrThrow({ where: { idempotencyKey: actionFixtures[0].key } });
      await prisma.$transaction(async (transaction) => {
        await transaction.category.update({ where: { name: "Hardware" }, data: { isActive: false } });
        await transaction.relatedSystem.update({ where: { name: "Campus Wi-Fi" }, data: { isActive: false } });
        await transaction.user.update({ where: { email: "admin@toktickit.test" }, data: { name: "Locally Changed Admin", isActive: false } });
        await transaction.ticket.update({
          where: { ticketNumber: ticketFixtures[0].ticketNumber },
          data: { status: "CLOSED", ownerId: null },
        });
        await transaction.actionTaken.update({ where: { id: editedAction.id }, data: { description: "Locally edited seeded action" } });
        await transaction.publicComment.update({ where: { id: seededComment.id }, data: { content: "Locally edited public comment" } });
        await transaction.internalNote.update({ where: { id: seededNote.id }, data: { content: "Locally edited internal note" } });
      });
      await runSeed(prisma);

      expect(await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" }, select: { isActive: true } })).toEqual({ isActive: false });
      expect(await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Campus Wi-Fi" }, select: { isActive: true } })).toEqual({ isActive: false });
      expect(await prisma.user.findUniqueOrThrow({ where: { email: "admin@toktickit.test" }, select: { name: true, isActive: true, passwordHash: true } }))
        .toEqual({ name: "Locally Changed Admin", isActive: false, passwordHash: adminBefore.passwordHash });
      expect(await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: ticketFixtures[0].ticketNumber }, select: { status: true, ownerId: true } }))
        .toEqual({ status: "CLOSED", ownerId: null });
      expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: editedAction.id }, select: { description: true } }))
        .toEqual({ description: "Locally edited seeded action" });
      expect(await prisma.publicComment.findUniqueOrThrow({ where: { id: seededComment.id }, select: { content: true } }))
        .toEqual({ content: "Locally edited public comment" });
      expect(await prisma.internalNote.findUniqueOrThrow({ where: { id: seededNote.id }, select: { content: true } }))
        .toEqual({ content: "Locally edited internal note" });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: unmanagedPasswordlessUser.id }, select: { passwordHash: true } }))
        .toEqual({ passwordHash: null });
      expect({
        users: await prisma.user.count(),
        tickets: await prisma.ticket.count(),
        actions: await prisma.actionTaken.count(),
        actionEvents: await prisma.actionEvent.count(),
        statusEvents: await prisma.ticketStatusEvent.count(),
        comments: await prisma.publicComment.count(),
        notes: await prisma.internalNote.count(),
      }).toEqual(countsBefore);
    });
  }, 120_000);

  it("re-homes missing Action samples instead of adding work to terminal legacy Tickets", async () => {
    await withIsolatedSchema(async (prisma) => {
      await applyLab3Baseline(prisma);

      const categoryRows = new Map<string, { id: number }>();
      for (const name of categories) categoryRows.set(name, await prisma.category.create({ data: { name } }));
      const systemRows = new Map<string, { id: number }>();
      for (const name of relatedSystems) systemRows.set(name, await prisma.relatedSystem.create({ data: { name } }));

      const requesterRows = new Map<string, { id: number }>();
      for (const requester of requesters) {
        requesterRows.set(requester.email, await prisma.user.create({ data: { ...requester, role: "REQUESTER" } }));
      }
      const staffRows = new Map<string, { id: number }>();
      for (const staff of staffUsers) {
        staffRows.set(staff.email, await prisma.user.create({ data: staff }));
      }

      const activeRequesters = requesters.filter(({ isActive }) => isActive);
      const activeStaff = staffUsers.filter(({ isActive, role }) => isActive && role === "IT_STAFF");
      const terminalStatuses = ["RESOLVED", "CLOSED", "CANCELLED"] as const;
      for (const fixtureIndex of [0, 1, 2] as const) {
        const fixture = ticketFixtures[fixtureIndex];
        const requesterId = requesterRows.get(activeRequesters[fixture.requesterIndex].email)!.id;
        const ownerId = fixture.ownerIndex === null ? null : staffRows.get(activeStaff[fixture.ownerIndex].email)!.id;
        const categoryId = categoryRows.get(categories[fixture.categoryIndex])!.id;
        const relatedSystemId = systemRows.get(relatedSystems[fixture.relatedSystemIndex])!.id;
        await prisma.$executeRaw`
          INSERT INTO "Ticket" (
            "ticketNumber", "requesterId", "ownerId", "categoryId", "relatedSystemId",
            "requestedPriority", "itPriority", status, summary, description
          ) VALUES (
            ${fixture.ticketNumber}, ${requesterId}, ${ownerId}, ${categoryId}, ${relatedSystemId},
            ${fixture.requestedPriority}::"RequestedPriority", ${fixture.itPriority}::"RequestedPriority",
            ${terminalStatuses[fixtureIndex]}::"TicketStatus", ${fixture.summary}, ${fixture.description}
          )
        `;
      }

      await applyMigration(prisma, "20261028000000_lab4_data_foundation");
      const terminalTicketNumbers = ticketFixtures.slice(0, 3).map(({ ticketNumber }) => ticketNumber);
      const before = await prisma.ticket.findMany({
        where: { ticketNumber: { in: terminalTicketNumbers } },
        orderBy: { ticketNumber: "asc" },
        select: { id: true, ticketNumber: true, status: true, workflowVersion: true, updatedAt: true },
      });

      await runSeed(prisma);

      const after = await prisma.ticket.findMany({
        where: { ticketNumber: { in: terminalTicketNumbers } },
        orderBy: { ticketNumber: "asc" },
        select: { id: true, ticketNumber: true, status: true, workflowVersion: true, updatedAt: true },
      });
      expect(after).toEqual(before);
      expect(await prisma.actionTaken.count({ where: { ticketId: { in: before.map(({ id }) => id) } } })).toBe(0);

      const fallbackTicket = await prisma.ticket.findUniqueOrThrow({
        where: { ticketNumber: actionFallbackTicketFixture.ticketNumber },
        select: { id: true, status: true, workflowVersion: true, updatedAt: true },
      });
      expect(fallbackTicket).toMatchObject({ status: "OPEN", workflowVersion: 8 });
      const fallbackActions = await prisma.actionTaken.findMany({
        where: { idempotencyKey: { in: actionFixtures.map(({ key }) => key) } },
        select: { id: true, ticketId: true, idempotencyKey: true },
      });
      expect(fallbackActions).toHaveLength(actionFixtures.length);
      expect(new Set(fallbackActions.map(({ ticketId }) => ticketId))).toEqual(new Set([fallbackTicket.id]));
      const latestFallbackEvent = await prisma.actionEvent.findFirstOrThrow({
        where: { actionId: { in: fallbackActions.map(({ id }) => id) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
      });
      expect(fallbackTicket.updatedAt.getTime()).toBeGreaterThanOrEqual(latestFallbackEvent.createdAt.getTime());

      const countsBeforeRerun = {
        tickets: await prisma.ticket.count(),
        actions: await prisma.actionTaken.count(),
        actionEvents: await prisma.actionEvent.count(),
        statusEvents: await prisma.ticketStatusEvent.count(),
      };
      await runSeed(prisma);
      expect({
        tickets: await prisma.ticket.count(),
        actions: await prisma.actionTaken.count(),
        actionEvents: await prisma.actionEvent.count(),
        statusEvents: await prisma.ticketStatusEvent.count(),
      }).toEqual(countsBeforeRerun);
      expect(await prisma.ticket.findUniqueOrThrow({
        where: { ticketNumber: actionFallbackTicketFixture.ticketNumber },
        select: { workflowVersion: true, updatedAt: true },
      })).toEqual({ workflowVersion: fallbackTicket.workflowVersion, updatedAt: fallbackTicket.updatedAt });
      expect(await prisma.ticket.findMany({
        where: { ticketNumber: { in: terminalTicketNumbers } },
        orderBy: { ticketNumber: "asc" },
        select: { id: true, ticketNumber: true, status: true, workflowVersion: true, updatedAt: true },
      })).toEqual(before);
    });
  }, 120_000);
});
