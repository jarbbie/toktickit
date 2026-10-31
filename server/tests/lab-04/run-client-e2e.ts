import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyMigration, withIsolatedSchema } from "./database-test-utils.js";

// Run the browser suite against an isolated migrated schema. Playwright's
// server startup and seed inherit this schema URL, which is dropped afterward.
await withIsolatedSchema(async (prisma, databaseUrl) => {
  for (const migration of [
    "20260809101008_init", "20260825000000_lab2_ticketing",
    "20260918000000_lab3_data_foundation", "20261028000000_lab4_data_foundation",
  ]) await applyMigration(prisma, migration);

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("npm", ["run", "test:e2e", "--", ...process.argv.slice(2)], {
      cwd: fileURLToPath(new URL("../../../client/", import.meta.url)),
      env: { ...process.env, DATABASE_URL: databaseUrl, TOKTICKIT_ISOLATED_E2E: "1" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
});
