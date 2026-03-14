import { test, expect } from "./fixtures/base.ts";
import { VERSION } from "../packages/core/src/index.ts";

test("--help prints usage and exits 0", async ({ cli }) => {
  const result = await cli(["--help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Usage:");
});

test("-h is an alias for --help", async ({ cli }) => {
  const { stdout: long } = await cli(["--help"]);
  const { stdout: short } = await cli(["-h"]);
  expect(short).toBe(long);
});

test("--version prints the version and exits 0", async ({ cli }) => {
  const result = await cli(["--version"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe(VERSION);
});

test("-v is an alias for --version", async ({ cli }) => {
  const { stdout: long } = await cli(["--version"]);
  const { stdout: short } = await cli(["-v"]);
  expect(short).toBe(long);
});

test("unknown flag exits non-zero and writes to stderr", async ({ cli }) => {
  const result = await cli(["--not-a-real-flag"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).not.toBe("");
});
