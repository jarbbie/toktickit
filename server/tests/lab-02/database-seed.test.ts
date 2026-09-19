import { describe, expect, it, vi } from "vitest";
import { categories, relatedSystems, requesters, seedDatabase } from "../../prisma/seed-data.js";

describe("Lab 2 seed data", () => {
  it("defines the required reference data and uses unique-key upserts", async () => {
    expect(categories).toHaveLength(4);
    expect(relatedSystems).toHaveLength(6);
    expect(requesters.filter((requester) => requester.isActive)).toHaveLength(4);
    expect(requesters.filter((requester) => !requester.isActive)).toHaveLength(1);

    const prisma = {
      category: { upsert: vi.fn().mockResolvedValue({}) },
      relatedSystem: { upsert: vi.fn().mockResolvedValue({}) },
      requester: { upsert: vi.fn().mockResolvedValue({}) },
    };
    await seedDatabase(prisma as never);
    await seedDatabase(prisma as never);

    expect(prisma.category.upsert).toHaveBeenCalledTimes(categories.length * 2);
    expect(prisma.relatedSystem.upsert).toHaveBeenCalledTimes(relatedSystems.length * 2);
    expect(prisma.requester.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: requesters[0].email } }));
  });
});
