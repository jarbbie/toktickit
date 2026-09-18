import { describe, expect, it } from "vitest";
import { LoginLimiter } from "../../src/auth.js";

describe("Lab 3 login limiter", () => {
  it("allows five failures, throttles the sixth, and isolates normalized-email/IP keys", () => {
    let now = 0;
    const limiter = new LoginLimiter(15 * 60 * 1000, () => now);
    const email = "nicha@toktickit.test";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.retryAfter(email, "127.0.0.1")).toBe(0);
      limiter.failure(email, "127.0.0.1");
    }
    expect(limiter.retryAfter(email, "127.0.0.1")).toBe(900);
    expect(limiter.retryAfter(email, "127.0.0.2")).toBe(0);
    limiter.success(email, "127.0.0.1");
    expect(limiter.retryAfter(email, "127.0.0.1")).toBe(0);

    limiter.failure(email, "127.0.0.1");
    now = 15 * 60 * 1000;
    expect(limiter.retryAfter(email, "127.0.0.1")).toBe(0);
  });
});
