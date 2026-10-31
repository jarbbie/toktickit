import { describe, expect, it } from "vitest";
import { validateTestDatabaseUrl } from "./database-test-utils.js";

describe("Lab 4 PostgreSQL test database guard", () => {
  it("allows only PostgreSQL databases with the disposable _test suffix", () => {
    expect(validateTestDatabaseUrl("postgresql://tester:secret@localhost:5432/toktickit_test?schema=public"))
      .toBe("postgresql://tester:secret@localhost:5432/toktickit_test?schema=public");
    expect(() => validateTestDatabaseUrl("postgresql://tester:secret@localhost:5432/toktickit?schema=public"))
      .toThrow(/ends in _test/);
    expect(() => validateTestDatabaseUrl("mysql://tester:secret@localhost:5432/toktickit_test"))
      .toThrow(/ends in _test/);
  });
});
