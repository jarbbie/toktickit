import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/lab-02/**/*.spec.ts", "**/lab-03/**/*.spec.ts"],
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  webServer: [
    { command: "npm run prisma:seed && npm run dev", cwd: "../server", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev -- --host 127.0.0.1", cwd: ".", url: "http://localhost:5173", reuseExistingServer: true, timeout: 120_000 },
  ],
});
