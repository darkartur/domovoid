import { writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "./fixtures/base.ts";
import { DEFAULT_PORT } from "../packages/runtime/src/index.ts";

const TEST_PORT = 17_777;
const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");

async function healthStatus(port: number): Promise<number | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
    return response.status;
  } catch {
    return undefined;
  }
}

test("DEFAULT_PORT is exported from runtime", () => {
  expect(DEFAULT_PORT).toBe(7777);
});

test("start launches daemon and health endpoint returns ok", async ({ cli }) => {
  try {
    const startResult = await cli(["start"], { DOMOVOID_PORT: String(TEST_PORT) });
    expect(startResult.exitCode).toBe(0);
    expect(startResult.stdout).toContain("Daemon started");

    await expect.poll(() => healthStatus(TEST_PORT)).toBe(200);

    const response = await fetch(`http://127.0.0.1:${String(TEST_PORT)}/health`);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  } finally {
    await cli(["stop"]);
  }
});

test("stop terminates the daemon", async ({ cli }) => {
  await cli(["start"], { DOMOVOID_PORT: String(TEST_PORT) });
  await expect.poll(() => healthStatus(TEST_PORT)).toBe(200);

  const stopResult = await cli(["stop"]);
  expect(stopResult.exitCode).toBe(0);
  expect(stopResult.stdout).toContain("Daemon stopped");

  await expect.poll(() => healthStatus(TEST_PORT), { timeout: 2000 }).toBeUndefined();
});

test("daemon uses DEFAULT_PORT when DOMOVOID_PORT is not set", async ({ cli }) => {
  try {
    await cli(["start"]);
    await expect.poll(() => healthStatus(DEFAULT_PORT)).toBe(200);
  } finally {
    await cli(["stop"]);
  }
});

test("stop fails when PID file contains invalid content", async ({ cli }) => {
  await writeFile(PID_FILE, "not-a-number");
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});
