import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  globalSetup: "./tests/storage-cleanup.ts",
  webServer: {
    command: "npm run verdaccio",
    url: "http://localhost:4873/",
    reuseExistingServer: false,
  },
});
