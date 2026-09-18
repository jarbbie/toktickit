import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

vi.mock("../src/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.js")>();
  return {
    ...actual,
    currentUser: vi.fn().mockResolvedValue({
      user: { id: 1, name: "Nicha Somchai", email: "nicha@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false },
      expiresAt: "2026-09-19T00:00:00.000Z",
    }),
  };
});

beforeEach(async () => {
  const api = await import("../src/api.js");
  vi.mocked(api.currentUser).mockResolvedValue({
    user: { id: 1, name: "Nicha Somchai", email: "nicha@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false },
    expiresAt: "2026-09-19T00:00:00.000Z",
  });
});
