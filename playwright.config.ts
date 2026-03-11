import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 5000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
      env: {
        DOMOVOID_DIR: "./.domovoid",
        DOMOVOID_CONFIG: "./tests/domovoid-config.yml",
      },
    },
  ],
});
