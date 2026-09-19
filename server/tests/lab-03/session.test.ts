import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken, SESSION_MAX_AGE_MS, sessionExpiry } from "../../src/auth.js";

describe("Lab 3 session utilities", () => {
  it("creates opaque 32-byte tokens and stores only a deterministic SHA-256 hash", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(Buffer.from(second, "base64url")).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
  });

  it("uses a fixed eight-hour expiry", () => {
    const now = new Date("2026-09-18T00:00:00.000Z");
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_MAX_AGE_MS);
  });
});
