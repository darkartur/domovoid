import { rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { test, expect } from "./fixtures/base.ts";

const PORT = 7777;
const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");
const require = createRequire(import.meta.url);
const { version: cliVersion } = require("../packages/cli/package.json") as { version: string };

async function healthStatus(): Promise<number | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(PORT)}/health`);
    return response.status;
  } catch {
    return undefined;
  }
}

test.use({ cliPath: "test-sandbox" });
test.describe.configure({ mode: "serial" });

test("reports the packaged CLI version", async ({ cli }) => {
  const result = await cli(["--version"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe(cliVersion);
});

test("daemon start/stop works for packaged CLI", async ({ cli }) => {
  try {
    const startResult = await cli(["start"]);
    expect(startResult.exitCode).toBe(0);
    expect(startResult.stdout).toContain("Daemon started");

    await expect.poll(() => healthStatus()).toBe(200);
  } finally {
    await cli(["stop"]);
    await expect.poll(() => healthStatus()).toBeUndefined();
  }
});

test("packaged stop fails when no daemon is running", async ({ cli }) => {
  await rm(PID_FILE, { force: true });
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});

test("packaged stop fails with invalid PID contents", async ({ cli }) => {
  await writeFile(PID_FILE, "not-a-number");
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});
