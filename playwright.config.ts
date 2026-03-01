import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/util/global-setup.ts",
  webServer: {
    command: "pnpm run verdaccio",
    url: "http://localhost:4873/-/ping",
    reuseExistingServer: !process.env["CI"],
  },
  workers: 1,
});
