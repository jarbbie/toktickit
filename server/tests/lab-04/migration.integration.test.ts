import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyLab3Baseline, applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const migration = "20261028000000_lab4_data_foundation";
const uploadsDirectory = fileURLToPath(new URL("../../uploads/", import.meta.url));

describe.skipIf(!testDatabaseEnabled)("Lab 4 populated PostgreSQL migration", () => {
  it("preserves Lab 1-3 rows, relationships, timestamps, and uploaded file bytes without fabricating history", async () => {
    const storageKey = `lab4-migration-${randomUUID()}.bin`;
    const uploadPath = join(uploadsDirectory, storageKey);
    const uploadBytes = Buffer.from("legacy attachment bytes\n", "utf8");
    mkdirSync(uploadsDirectory, { recursive: true });
    writeFileSync(uploadPath, uploadBytes, { flag: "wx" });

    try {
      await withIsolatedSchema(async (prisma) => {
        await applyLab3Baseline(prisma, storageKey);
        const before = {
          user: await prisma.user.findUniqueOrThrow({ where: { id: 21 } }),
          staff: await prisma.user.findUniqueOrThrow({ where: { id: 22 } }),
          category: await prisma.category.findUniqueOrThrow({ where: { id: 11 } }),
          relatedSystem: await prisma.relatedSystem.findUniqueOrThrow({ where: { id: 31 } }),
          ticket: await prisma.ticket.findUniqueOrThrow({
            where: { id: 41 },
            select: {
              id: true, ticketNumber: true, requesterId: true, ownerId: true, categoryId: true,
              relatedSystemId: true, requestedPriority: true, itPriority: true, status: true,
              resolutionIndicatedAt: true, summary: true, description: true, createdAt: true, updatedAt: true,
            },
          }),
          attachment: await prisma.attachment.findUniqueOrThrow({ where: { id: 51 } }),
          comment: await prisma.publicComment.findUniqueOrThrow({ where: { id: 61 } }),
          note: await prisma.internalNote.findUniqueOrThrow({ where: { id: 71 } }),
        };
        const sequencesBefore = await prisma.$queryRaw<Array<Record<string, bigint>>>`
          SELECT
            pg_sequence_last_value(pg_get_serial_sequence('"User"', 'id')) AS user_id,
            pg_sequence_last_value(pg_get_serial_sequence('"Ticket"', 'id')) AS ticket_id,
            pg_sequence_last_value(pg_get_serial_sequence('"Attachment"', 'id')) AS attachment_id,
            pg_sequence_last_value(pg_get_serial_sequence('"PublicComment"', 'id')) AS public_comment_id,
            pg_sequence_last_value(pg_get_serial_sequence('"InternalNote"', 'id')) AS internal_note_id
        `;

        await applyMigration(prisma, migration);

        const after = {
          user: await prisma.user.findUniqueOrThrow({ where: { id: 21 } }),
          staff: await prisma.user.findUniqueOrThrow({ where: { id: 22 } }),
          category: await prisma.category.findUniqueOrThrow({ where: { id: 11 } }),
          relatedSystem: await prisma.relatedSystem.findUniqueOrThrow({ where: { id: 31 } }),
          ticket: await prisma.ticket.findUniqueOrThrow({
            where: { id: 41 },
            select: {
              id: true, ticketNumber: true, requesterId: true, ownerId: true, categoryId: true,
              relatedSystemId: true, requestedPriority: true, itPriority: true, status: true,
              resolutionIndicatedAt: true, summary: true, description: true, createdAt: true, updatedAt: true,
            },
          }),
          attachment: await prisma.attachment.findUniqueOrThrow({ where: { id: 51 } }),
          comment: await prisma.publicComment.findUniqueOrThrow({ where: { id: 61 } }),
          note: await prisma.internalNote.findUniqueOrThrow({ where: { id: 71 } }),
        };
        expect(after).toEqual(before);
        expect(await prisma.$queryRaw<Array<Record<string, bigint>>>`
          SELECT
            pg_sequence_last_value(pg_get_serial_sequence('"User"', 'id')) AS user_id,
            pg_sequence_last_value(pg_get_serial_sequence('"Ticket"', 'id')) AS ticket_id,
            pg_sequence_last_value(pg_get_serial_sequence('"Attachment"', 'id')) AS attachment_id,
            pg_sequence_last_value(pg_get_serial_sequence('"PublicComment"', 'id')) AS public_comment_id,
            pg_sequence_last_value(pg_get_serial_sequence('"InternalNote"', 'id')) AS internal_note_id
        `).toEqual(sequencesBefore);
        expect(await prisma.ticket.findUniqueOrThrow({ where: { id: 41 }, select: { workflowVersion: true } })).toEqual({ workflowVersion: 1 });
        expect(after.ticket.ownerId).toBe(22);
        expect(after.category.isActive).toBe(false);
        expect(after.relatedSystem.isActive).toBe(false);
        expect(existsSync(uploadPath)).toBe(true);
        expect(readFileSync(uploadPath)).toEqual(uploadBytes);
        expect(await prisma.actionTaken.count()).toBe(0);
        expect(await prisma.actionEvent.count()).toBe(0);
        expect(await prisma.ticketStatusEvent.count()).toBe(0);

        const legacyResolved = await prisma.ticket.create({
          data: {
            ticketNumber: "TKT-2026-LEGACY02",
            requesterId: 21,
            ownerId: 22,
            categoryId: 11,
            relatedSystemId: 31,
            summary: "Legacy resolved ticket",
            description: "A legacy status does not imply a Lab 4 transition event.",
            status: "RESOLVED",
          },
        });
        expect(legacyResolved.workflowVersion).toBe(1);
        expect(await prisma.ticketStatusEvent.count({ where: { ticketId: legacyResolved.id } })).toBe(0);
      });
    } finally {
      unlinkSync(uploadPath);
    }
  }, 60_000);
});
