import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actionFixtures, lab4DashboardUsers, recentResolvedTicketFixture, seedDatabase, ticketFixtures } from "../../prisma/seed-data.js";
import { applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

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
      expect(actionRows).toHaveLength(actionFixtures.length);
      expect(new Set(actionRows.map(({ status }) => status))).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
      const actionCounts = new Map<string, number>();
      for (const action of actionRows) actionCounts.set(action.ticket.ticketNumber, (actionCounts.get(action.ticket.ticketNumber) ?? 0) + 1);
      expect(actionCounts.get(ticketFixtures[0].ticketNumber)).toBe(2);
      expect(actionCounts.get(ticketFixtures[1].ticketNumber)).toBe(1);
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
        select: { id: true, status: true, workflowVersion: true },
      });
      expect(recentResolved).toMatchObject({ status: "RESOLVED", workflowVersion: 2 });
      expect(await prisma.ticketStatusEvent.count({ where: { ticketId: recentResolved.id, toStatus: "RESOLVED" } })).toBe(1);

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
});
