import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Requires the DB to be migrated and seeded first.
describe("GET /api/categories", () => {
  it("returns the active seeded categories in name order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body.map((category: { name: string }) => category.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Network",
      "Software",
    ]);
  });
});
