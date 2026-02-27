import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const mockNpmPath = fileURLToPath(new URL("tests/mock-npm.ts", import.meta.url));

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
      env: {
        DOMOVOID_NPM_BIN: mockNpmPath,
        DOMOVOID_NO_RESTART: "1",
      },
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
