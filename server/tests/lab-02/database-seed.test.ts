import { describe, expect, it, vi } from "vitest";
import { categories, relatedSystems, requesters, seedDatabase, staffUsers, ticketFixtures } from "../../prisma/seed-data.js";

describe("Lab 2 seed data", () => {
  it("defines the required reference data and uses unique-key upserts", async () => {
    expect(categories).toHaveLength(4);
    expect(relatedSystems).toHaveLength(6);
    expect(requesters.filter((requester) => requester.isActive)).toHaveLength(4);
    expect(requesters.filter((requester) => !requester.isActive)).toHaveLength(1);
    expect(staffUsers.filter((user) => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
    expect(ticketFixtures).toHaveLength(24);

    const requesterRows = Array.from({ length: 4 }, (_, index) => ({ id: index + 1 }));
    const ownerRows = Array.from({ length: 3 }, (_, index) => ({ id: index + 10 }));
    const userFindMany = vi.fn()
      .mockResolvedValueOnce([{ id: 100 }, { id: 101 }]).mockResolvedValueOnce(requesterRows).mockResolvedValueOnce(ownerRows)
      .mockResolvedValueOnce([]).mockResolvedValueOnce(requesterRows).mockResolvedValueOnce(ownerRows);

    const prisma = {
      category: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([1, 2, 3, 4].map((id) => ({ id }))) },
      relatedSystem: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([1, 2, 3, 4, 5, 6].map((id) => ({ id }))) },
      user: { upsert: vi.fn().mockResolvedValue({}), findMany: userFindMany, update: vi.fn() },
      ticket: { upsert: vi.fn().mockResolvedValue({}), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1 }) },
      publicComment: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 }), create: vi.fn().mockResolvedValue({}) },
      internalNote: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 }), create: vi.fn().mockResolvedValue({}) },
    };
    await seedDatabase(prisma as never);
    await seedDatabase(prisma as never);

    expect(prisma.category.upsert).toHaveBeenCalledTimes(categories.length * 2);
    expect(prisma.relatedSystem.upsert).toHaveBeenCalledTimes(relatedSystems.length * 2);
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: requesters[0].email } }));
    const firstRunHashes = prisma.user.upsert.mock.calls.slice(0, requesters.length + staffUsers.length).map(([call]) => call.create.passwordHash);
    expect(new Set(firstRunHashes).size).toBe(firstRunHashes.length);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    const bootstrapHashes = prisma.user.update.mock.calls.map(([call]) => call.data.passwordHash);
    expect(new Set(bootstrapHashes).size).toBe(bootstrapHashes.length);
    expect(prisma.ticket.upsert).toHaveBeenCalledTimes(ticketFixtures.length * 2);
    expect(prisma.publicComment.create).toHaveBeenCalledTimes(1);
    expect(prisma.internalNote.create).toHaveBeenCalledTimes(1);
  });
});
