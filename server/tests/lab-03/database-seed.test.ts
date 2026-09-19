import { afterAll, describe, expect, it } from "vitest";
import { seedDatabase, ticketFixtures } from "../../prisma/seed-data.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("Lab 3 database seed", () => {
  afterAll(() => prisma.$disconnect());

  it("is repeat-safe and provides the required roles and workflow data", async () => {
    await seedDatabase(prisma);
    const before = await Promise.all([
      prisma.user.count(), prisma.ticket.count(), prisma.publicComment.count(), prisma.internalNote.count(),
    ]);
    const hashesBeforeRerun = await prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, passwordHash: true } });
    await seedDatabase(prisma);
    const after = await Promise.all([
      prisma.user.count(), prisma.ticket.count(), prisma.publicComment.count(), prisma.internalNote.count(),
    ]);
    expect(after).toEqual(before);
    expect(await prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, passwordHash: true } })).toEqual(hashesBeforeRerun);

    expect(await prisma.user.count({ where: { role: "REQUESTER", isActive: true } })).toBeGreaterThanOrEqual(4);
    expect(await prisma.user.count({ where: { role: "REQUESTER", isActive: false } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.ticket.count({ where: { ticketNumber: { in: ticketFixtures.map(({ ticketNumber }) => ticketNumber) } } })).toBe(24);

    const seededTickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: ticketFixtures.map(({ ticketNumber }) => ticketNumber) } },
      select: { status: true, requestedPriority: true, ownerId: true },
    });
    expect(new Set(seededTickets.map(({ status }) => status)).size).toBe(8);
    expect(new Set(seededTickets.map(({ requestedPriority }) => requestedPriority)).size).toBe(4);
    expect(seededTickets.some(({ ownerId }) => ownerId === null)).toBe(true);
    expect(seededTickets.some(({ ownerId }) => ownerId !== null)).toBe(true);

    const users = await prisma.user.findMany({ select: { passwordHash: true } });
    expect(users.every(({ passwordHash }) => passwordHash?.startsWith("$argon2id$") === true)).toBe(true);
    const requesterHashes = await prisma.user.findMany({ where: { role: "REQUESTER" }, select: { passwordHash: true } });
    expect(new Set(requesterHashes.map(({ passwordHash }) => passwordHash)).size).toBe(requesterHashes.length);
  }, 30_000);

  it("does not overwrite changed account, ownership, or workflow data", async () => {
    await expect(prisma.$transaction(async (transaction) => {
      const admin = await transaction.user.findUniqueOrThrow({ where: { email: "admin@toktickit.test" } });
      const ticket = await transaction.ticket.findUniqueOrThrow({ where: { ticketNumber: ticketFixtures[0].ticketNumber } });
      await transaction.user.update({ where: { id: admin.id }, data: { name: "Locally Changed Admin", isActive: false } });
      await transaction.ticket.update({ where: { id: ticket.id }, data: { status: "CLOSED", ownerId: null } });

      await seedDatabase(transaction as never);

      expect(await transaction.user.findUnique({ where: { id: admin.id }, select: { name: true, isActive: true, passwordHash: true } })).toEqual({
        name: "Locally Changed Admin", isActive: false, passwordHash: admin.passwordHash,
      });
      expect(await transaction.ticket.findUnique({ where: { id: ticket.id }, select: { status: true, ownerId: true } })).toEqual({ status: "CLOSED", ownerId: null });
      throw new Error("ROLLBACK_SEED_PRESERVATION_TEST");
    }, { timeout: 30_000 })).rejects.toThrow("ROLLBACK_SEED_PRESERVATION_TEST");
  }, 35_000);
});
