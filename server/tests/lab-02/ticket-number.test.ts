import { describe, expect, it } from "vitest";
import { generateTicketNumber } from "../../src/ticket-number.js";

describe("generateTicketNumber", () => {
  it("creates the documented ticket-number format", () => {
    expect(generateTicketNumber(new Date("2026-08-25T00:00:00.000Z"))).toMatch(/^TKT-2026-[A-F0-9]{8}$/);
  });
});
