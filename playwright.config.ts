import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
    },
    {
      command: "node tests/mock-registry.ts",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 10_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
    },
  ],
});
