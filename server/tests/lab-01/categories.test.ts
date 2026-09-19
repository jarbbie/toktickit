import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// The Lab 3 contract protects reference data; detailed active-reference behavior
// is covered by the authenticated Lab 2 reference-data test.
describe("GET /api/categories", () => {
  it("requires an authenticated session", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
