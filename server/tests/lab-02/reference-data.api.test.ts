import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  requester: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  relatedSystem: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

describe("Lab 2 reference-data APIs", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns active requesters ordered by name", async () => {
    prisma.requester.findMany.mockResolvedValue([{ id: 2, name: "Anan", email: "anan@example.test" }]);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 2, name: "Anan", email: "anan@example.test" }]);
    expect(prisma.requester.findMany).toHaveBeenCalledWith({
      where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true },
    });
  });

  it("returns only active categories and related systems ordered by name", async () => {
    prisma.category.findMany.mockResolvedValue([{ id: 1, name: "Hardware" }]);
    prisma.relatedSystem.findMany.mockResolvedValue([{ id: 3, name: "VPN" }]);

    const [categories, relatedSystems] = await Promise.all([
      request(app).get("/api/categories"),
      request(app).get("/api/related-systems"),
    ]);

    expect(categories.body).toEqual([{ id: 1, name: "Hardware" }]);
    expect(relatedSystems.body).toEqual([{ id: 3, name: "VPN" }]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true },
    });
    expect(prisma.relatedSystem.findMany).toHaveBeenCalledWith({
      where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true },
    });
  });

  it("returns a safe error when reference data cannot be loaded", async () => {
    prisma.requester.findMany.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unable to load requesters." });
  });
});
