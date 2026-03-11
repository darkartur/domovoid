import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  globalSetup: "./tests/verdaccio-setup.ts",
});
