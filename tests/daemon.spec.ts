import { rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "./fixtures/base.ts";
import { DEFAULT_PORT } from "../packages/runtime/src/index.ts";

const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");

async function healthStatus(): Promise<number | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(DEFAULT_PORT)}/health`);
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
    const startResult = await cli(["start"]);
    expect(startResult.exitCode).toBe(0);
    expect(startResult.stdout).toContain("Daemon started");

    await expect.poll(() => healthStatus()).toBe(200);

    const response = await fetch(`http://127.0.0.1:${String(DEFAULT_PORT)}/health`);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  } finally {
    await cli(["stop"]);
  }
});

test("stop terminates the daemon", async ({ cli }) => {
  await cli(["start"]);
  await expect.poll(() => healthStatus()).toBe(200);

  const stopResult = await cli(["stop"]);
  expect(stopResult.exitCode).toBe(0);
  expect(stopResult.stdout).toContain("Daemon stopped");

  await expect.poll(() => healthStatus(), { timeout: 2000 }).toBeUndefined();
});

test("stop fails when no daemon is running", async ({ cli }) => {
  await rm(PID_FILE, { force: true });
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});

test("stop fails when PID file contains invalid content", async ({ cli }) => {
  await writeFile(PID_FILE, "not-a-number");
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});
