import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, passwordError, verifyPassword } from "../../src/auth.js";

describe("Lab 3 password and identity utilities", () => {
  it("normalizes only valid bounded email addresses", () => {
    expect(normalizeEmail("  Nicha.Somchai@TokTickIT.Test ")).toBe("nicha.somchai@toktickit.test");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a".repeat(250) + "@x.test")).toBeNull();
  });

  it.each([[11, true], [12, false], [128, false], [129, true]])("enforces the password boundary at %i characters", (length, invalid) => {
    expect(Boolean(passwordError("x".repeat(length)))).toBe(invalid);
  });

  it("uses distinct Argon2id hashes and verifies exact, untrimmed input", async () => {
    const password = "Lab3-Exact-Password!";
    const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
    expect(first).toMatch(/^\$argon2id\$/);
    expect(second).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword(first, password)).resolves.toBe(true);
    await expect(verifyPassword(first, ` ${password}`)).resolves.toBe(false);
  });
});
