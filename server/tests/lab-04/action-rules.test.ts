import { describe, expect, it } from "vitest";
import { parseActionTimestamp, validateActionFields } from "../../src/actions.js";

const validFields = {
  actionAt: "2026-10-30T09:30:00+07:00",
  description: "Restore the network route",
  followUpRequired: false,
  followUpNote: "",
  result: "",
  attachmentNotes: "",
};

describe("Action input rules", () => {
  it("accepts explicit-offset timestamps and preserves their represented instant", () => {
    expect(parseActionTimestamp("2026-10-30T09:30:00+07:00").toISOString()).toBe("2026-10-30T02:30:00.000Z");
    expect(parseActionTimestamp("2024-02-29T23:59Z").toISOString()).toBe("2024-02-29T23:59:00.000Z");
  });

  it.each([
    "2026-10-30T09:30:00",
    "2026-02-29T09:30:00Z",
    "2026-13-01T09:30:00Z",
    "2026-10-30T24:00:00Z",
    "2026-10-30T09:30:00+24:00",
  ])("rejects invalid or offset-free timestamp %s", (value) => {
    expect(() => parseActionTimestamp(value)).toThrow();
  });

  it("accepts text at the documented boundaries and rejects values over them", () => {
    expect(validateActionFields({
      ...validFields,
      description: "d".repeat(2000),
      followUpRequired: true,
      followUpNote: "n".repeat(1000),
      attachmentNotes: "a".repeat(1000),
    }).description).toHaveLength(2000);
    expect(() => validateActionFields({ ...validFields, description: "d".repeat(2001) })).toThrow();
    expect(() => validateActionFields({ ...validFields, followUpRequired: true, followUpNote: "n".repeat(1001) })).toThrow();
    expect(() => validateActionFields({ ...validFields, attachmentNotes: "a".repeat(1001) })).toThrow();
  });

  it("requires a follow-up note when enabled and clears a previous note when disabled", () => {
    expect(() => validateActionFields({ ...validFields, followUpRequired: true, followUpNote: "  " })).toThrow();

    const current = {
      actionAt: new Date("2026-10-30T02:30:00.000Z"),
      description: "Restore the network route",
      followUpRequired: true,
      followUpNote: "Check stability tomorrow",
      result: null,
      attachmentNotes: null,
      status: "PLANNED",
    } as unknown as Parameters<typeof validateActionFields>[1];
    expect(validateActionFields({ followUpRequired: false }, current).followUpNote).toBeNull();
  });

  it("requires a result for completed Actions and accepts optional text as empty", () => {
    expect(validateActionFields({ ...validFields, result: "  ", attachmentNotes: "  " }).result).toBeNull();
    const completed = {
      actionAt: new Date("2026-10-30T02:30:00.000Z"),
      description: "Restore the network route",
      followUpRequired: false,
      followUpNote: null,
      result: null,
      attachmentNotes: null,
      status: "COMPLETED",
    } as unknown as Parameters<typeof validateActionFields>[1];
    expect(() => validateActionFields({ result: "  " }, completed)).toThrow();
    expect(validateActionFields({ result: "Verified service" }, completed).result).toBe("Verified service");
  });
});
