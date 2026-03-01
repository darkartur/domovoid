import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm start --workspace @domovoid/integration-claude-agent vcr-proxy",
      url: "http://localhost:8082/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 5000,
    },
    {
      command: "npm run start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
    },
  ],
});
