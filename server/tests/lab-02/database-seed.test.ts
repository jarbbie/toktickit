import { describe, expect, it, vi } from "vitest";
import { actionFixtures, categories, lab4DashboardUsers, relatedSystems, requesters, seedDatabase, staffUsers, ticketFixtures } from "../../prisma/seed-data.js";

describe("Lab 2 seed data", () => {
  it("defines the required reference data and uses unique-key upserts", async () => {
    expect(categories).toHaveLength(4);
    expect(relatedSystems).toHaveLength(6);
    expect(requesters.filter((requester) => requester.isActive)).toHaveLength(4);
    expect(requesters.filter((requester) => !requester.isActive)).toHaveLength(1);
    expect(staffUsers.filter((user) => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
    expect(ticketFixtures).toHaveLength(24);

    const activeRequesters = requesters.filter((requester) => requester.isActive);
    const activeStaff = staffUsers.filter((user) => user.role === "IT_STAFF" && user.isActive);
    const requesterRows = activeRequesters.map((user, index) => ({ id: index + 1, email: user.email }));
    const ownerRows = activeStaff.map((user, index) => ({ id: index + 10, email: user.email, name: user.name }));
    const categoryRows = categories.map((name, index) => ({ id: index + 20, name }));
    const systemRows = relatedSystems.map((name, index) => ({ id: index + 30, name }));
    const userFindMany = vi.fn()
      .mockResolvedValueOnce([{ id: 100 }, { id: 101 }]).mockResolvedValueOnce(requesterRows).mockResolvedValueOnce(ownerRows)
      .mockResolvedValueOnce([]).mockResolvedValueOnce(requesterRows).mockResolvedValueOnce(ownerRows);
    const actionRows = new Map<string, { id: number; idempotencyKey: string; [key: string]: unknown }>();
    let nextActionId = 1;
    let recentResolved: { id: number; [key: string]: unknown } | null = null;

    const prisma = {
      category: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue(categoryRows) },
      relatedSystem: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue(systemRows) },
      user: { upsert: vi.fn().mockResolvedValue({}), findMany: userFindMany, update: vi.fn() },
      ticket: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockImplementation(async () => recentResolved),
        create: vi.fn().mockImplementation(async ({ data }) => (recentResolved = { id: 500, ...data })),
        update: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1 }),
      },
      actionTaken: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => actionRows.get(where.idempotencyKey) ?? null),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const row = { id: nextActionId++, idempotencyKey: data.idempotencyKey, ...data };
          actionRows.set(data.idempotencyKey, row);
          return row;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      actionEvent: { create: vi.fn().mockResolvedValue({}) },
      ticketStatusEvent: { create: vi.fn().mockResolvedValue({}) },
      publicComment: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 }), create: vi.fn().mockResolvedValue({}) },
      internalNote: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 }), create: vi.fn().mockResolvedValue({}) },
    };
    await seedDatabase(prisma as never);
    await seedDatabase(prisma as never);

    expect(prisma.category.upsert).toHaveBeenCalledTimes(categories.length * 2);
    expect(prisma.relatedSystem.upsert).toHaveBeenCalledTimes(relatedSystems.length * 2);
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: requesters[0].email } }));
    const firstRunHashes = prisma.user.upsert.mock.calls.slice(0, requesters.length + staffUsers.length + lab4DashboardUsers.length).map(([call]) => call.create.passwordHash);
    expect(new Set(firstRunHashes).size).toBe(firstRunHashes.length);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    const bootstrapHashes = prisma.user.update.mock.calls.map(([call]) => call.data.passwordHash);
    expect(new Set(bootstrapHashes).size).toBe(bootstrapHashes.length);
    expect(prisma.ticket.upsert).toHaveBeenCalledTimes(ticketFixtures.length * 2);
    expect(prisma.actionTaken.create).toHaveBeenCalledTimes(actionFixtures.length);
    expect(prisma.actionEvent.create).toHaveBeenCalledTimes(actionFixtures.length + 3);
    expect(prisma.ticketStatusEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.publicComment.create).toHaveBeenCalledTimes(1);
    expect(prisma.internalNote.create).toHaveBeenCalledTimes(1);
  });
});
