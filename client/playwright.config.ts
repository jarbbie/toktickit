import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/lab-02",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    { command: "npm run prisma:seed && npm run dev", cwd: "../server", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev -- --host 127.0.0.1", cwd: ".", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 120_000 },
  ],
});
