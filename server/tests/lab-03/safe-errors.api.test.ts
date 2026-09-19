import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => ({}) }));

import { app } from "../../src/app.js";

describe("Lab 3 safe API errors", () => {
  it("returns JSON for malformed JSON instead of Express HTML or a stack trace", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .set("Content-Type", "application/json")
      .send('{"summary":');

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: "Malformed JSON request body." });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|\/home\/|app\.ts/i);
  });

  it("returns a safe JSON 413 for an oversized JSON body", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .set("Content-Type", "application/json")
      .send({ summary: "x".repeat(110_000) });

    expect(response.status).toBe(413);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: "Request body exceeds the size limit." });
  });
});
