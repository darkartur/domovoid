import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/util/global-setup.ts",
  webServer: [
    {
      command: "npm start --workspace @domovoid/integration-claude-agent vcr-proxy",
      url: "http://localhost:8082/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 5000,
    },
    {
      command: "pnpm run verdaccio",
      url: "http://localhost:4873/-/ping",
      reuseExistingServer: !process.env["CI"],
    },
  ],
  workers: 1,
});
