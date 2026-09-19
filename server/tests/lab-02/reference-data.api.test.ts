import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  session: { findUnique: vi.fn() },
  category: { findMany: vi.fn() },
  relatedSystem: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";

describe("Lab 2 reference-data APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2099-01-01"), user: { id: 1, name: "Nicha", email: "nicha@toktickit.test", role: "REQUESTER", isActive: true, mustChangePassword: false } });
  });

  it("removes the obsolete requester reference endpoint", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found.", code: "NOT_FOUND" });
  });

  it("returns only active categories and related systems ordered by name", async () => {
    prisma.category.findMany.mockResolvedValue([{ id: 1, name: "Hardware" }]);
    prisma.relatedSystem.findMany.mockResolvedValue([{ id: 3, name: "VPN" }]);

    const [categories, relatedSystems] = await Promise.all([
      request(app).get("/api/categories").set("Cookie", "toktickit_session=token"),
      request(app).get("/api/related-systems").set("Cookie", "toktickit_session=token"),
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
    prisma.category.findMany.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/categories").set("Cookie", "toktickit_session=token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unable to load request categories." });
  });
});
