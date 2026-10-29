import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyMigration, withIsolatedSchema } from "./database-test-utils.js";

// Inherited database tests use DATABASE_URL and expect an already migrated
// schema. Give their child process a disposable schema, never the app database.
await withIsolatedSchema(async (prisma, databaseUrl) => {
  for (const migration of [
    "20260809101008_init", "20260825000000_lab2_ticketing",
    "20260918000000_lab3_data_foundation", "20261028000000_lab4_data_foundation",
  ]) await applyMigration(prisma, migration);

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL("../../node_modules/vitest/vitest.mjs", import.meta.url)),
      "run", ...process.argv.slice(2),
    ], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
});
