import { describe, expect, it } from "vitest";
import { applyLab3Baseline, applyMigration, executeSqlTransaction, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const migration = "20261028000000_lab4_data_foundation";
const conflictingIndex = "TicketStatusEvent_toStatus_changedAt_ticketId_id_idx";

describe.skipIf(!testDatabaseEnabled)("Lab 4 migration recovery on disposable PostgreSQL schema", () => {
  it("rolls back a failed additive migration and succeeds after the conflict is repaired", async () => {
    await withIsolatedSchema(async (prisma) => {
      await applyLab3Baseline(prisma, "lab4-recovery.bin");
      await executeSqlTransaction(prisma, `CREATE INDEX "${conflictingIndex}" ON "Ticket" ("id");`);

      await expect(applyMigration(prisma, migration)).rejects.toThrow();

      const lab4Tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name IN ('ActionTaken', 'ActionEvent', 'TicketStatusEvent')
        ORDER BY table_name
      `;
      const workflowColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'Ticket' AND column_name = 'workflowVersion'
      `;
      expect(lab4Tables).toEqual([]);
      expect(workflowColumns).toEqual([]);
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: 41 }, select: { ticketNumber: true, summary: true, updatedAt: true } }))
        .toMatchObject({ ticketNumber: "TKT-2026-LEGACY01", summary: "Legacy ticket", updatedAt: new Date("2026-01-05T00:00:00.000Z") });
      expect(await prisma.attachment.count()).toBe(1);

      await executeSqlTransaction(prisma, `DROP INDEX "${conflictingIndex}";`);
      await applyMigration(prisma, migration);

      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: 41 }, select: { workflowVersion: true } })).toEqual({ workflowVersion: 1 });
      expect(await prisma.actionTaken.count()).toBe(0);
      expect(await prisma.ticketStatusEvent.count()).toBe(0);
    });
  }, 60_000);
});
