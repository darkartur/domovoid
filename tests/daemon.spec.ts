import { test, expect } from "./fixtures/base.ts";
import { healthJson } from "./util/health.ts";

import info from "../packages/runtime/package.json" with { type: "json" };

const runtimeVersion = info.version;
test.describe.configure({ mode: "serial" });

test("start launches daemon and health endpoint returns ok", async ({ cli }) => {
  const startResult = await cli(["start"]);
  expect(startResult.exitCode).toBe(0);
  expect(startResult.stdout).toContain("Daemon started");

  await expect.poll(() => healthJson()).toEqual({ status: "ok", version: runtimeVersion });
});

test("health endpoint includes runtime version", async ({ cli }) => {
  await cli(["start"]);

  await expect
    .poll(() => healthJson())
    .toEqual({
      status: "ok",
      version: runtimeVersion,
    });
});

test("stop terminates the daemon", async ({ cli }) => {
  await cli(["start"]);
  await expect.poll(() => healthJson()).toMatchObject({ status: "ok" });

  const stopResult = await cli(["stop"]);
  expect(stopResult.exitCode).toBe(0);
  expect(stopResult.stdout).toContain("Daemon stopped");

  await expect.poll(() => healthJson(), { timeout: 2000 }).toBeUndefined();
});

test("stop fails when no daemon is running", async ({ cli }) => {
  const result = await cli(["stop"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Error");
});
