import { defineConfig } from "@playwright/test";

const apiPort = process.env.TOKTICKIT_E2E_API_PORT ?? "3000";
const webPort = process.env.TOKTICKIT_E2E_WEB_PORT ?? "5173";
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/lab-02/**/*.spec.ts", "**/lab-03/**/*.spec.ts", "**/lab-04/**/*.spec.ts"],
  timeout: 60_000,
  workers: 1,
  use: { baseURL: webUrl, trace: "retain-on-failure" },
  // Isolated E2E runs must start their own app/server processes against the
  // disposable database schema supplied by run-client-e2e.ts.
  webServer: [
    { command: "npm run prisma:seed && npm run dev", cwd: "../server", url: `${apiUrl}/api/health`, env: { PORT: apiPort, CLIENT_ORIGIN: webUrl }, reuseExistingServer: process.env.TOKTICKIT_ISOLATED_E2E !== "1", timeout: 120_000 },
    { command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`, cwd: ".", url: webUrl, env: { VITE_API_URL: apiUrl }, reuseExistingServer: process.env.TOKTICKIT_ISOLATED_E2E !== "1", timeout: 120_000 },
  ],
});
