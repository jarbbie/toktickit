import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/lab-02/**/*.spec.ts", "**/lab-03/**/*.spec.ts", "**/lab-04/**/*.spec.ts"],
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  // Isolated E2E runs must start their own app/server processes against the
  // disposable database schema supplied by run-client-e2e.ts.
  webServer: [
    { command: "npm run prisma:seed && npm run dev", cwd: "../server", url: "http://localhost:3000/api/health", reuseExistingServer: process.env.TOKTICKIT_ISOLATED_E2E !== "1", timeout: 120_000 },
    { command: "npm run dev -- --host 127.0.0.1", cwd: ".", url: "http://localhost:5173", reuseExistingServer: process.env.TOKTICKIT_ISOLATED_E2E !== "1", timeout: 120_000 },
  ],
});
