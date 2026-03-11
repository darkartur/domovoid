import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

// const ANTHROPIC_PROXY_URL = "http://localhost:8082";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    // {
    //   command: "npm --workspace @domovoid/integration-claude-agent run vcr-proxy",
    //   url: `${ANTHROPIC_PROXY_URL}/health`,
    //   reuseExistingServer: !process.env["CI"],
    //   timeout: 5000,
    // },
    {
      command: "npm run start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 5000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
      env: {
        DOMOVOID_DIR: "./.domovoid",
        // ANTHROPIC_BASE_URL: ANTHROPIC_PROXY_URL,
        DOMOVOID_CONFIG: "./tests/domovoid-config.yml",
      },
    },
  ],
});
