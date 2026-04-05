import { inc } from "semver";
import { test, expect } from "./fixtures/base.ts";
import { healthJson } from "./util/health.ts";

import info from "../packages/runtime/package.json" with { type: "json" };

const currentVersion = info.version;
const nextVersion = inc(currentVersion, "patch");
if (!nextVersion) throw new Error(`Failed to bump version: ${currentVersion}`);

const AUTOUPDATE_ENV = {
  DOMOVOID_AUTOUPDATE: "1",
  DOMOVOID_UPDATE_INTERVAL_MS: "100",
};

test.describe.configure({ timeout: 60_000 });

test("runs without autoupdate when DOMOVOID_AUTOUPDATE is unset", async ({ cli }) => {
  await cli(["start"]);
  await expect.poll(() => healthJson()).toMatchObject({ status: "ok" });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(await healthJson()).toMatchObject({ status: "ok" });
});

test("keeps running when already on latest version", async ({ cli }) => {
  await cli(["start"], AUTOUPDATE_ENV);
  await expect.poll(() => healthJson()).toMatchObject({ status: "ok" });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  expect(await healthJson()).toMatchObject({ version: currentVersion });
});

test("updates when new version is published while running", async ({ cli, publishVersion }) => {
  await cli(["start"], AUTOUPDATE_ENV);
  await expect.poll(() => healthJson()).toMatchObject({ status: "ok" });
  expect(await healthJson()).toMatchObject({ version: currentVersion });

  await publishVersion(nextVersion);

  await expect
    .poll(() => healthJson(), {
      timeout: 30_000,
      message: "Health endpoint should report nextVersion after update",
    })
    .toMatchObject({ version: nextVersion });

  const result = await cli(["--version"]);
  expect(result.stdout.trim()).toBe(nextVersion);
});

test("keeps running when install fails", async ({ cli, publishVersion }) => {
  await publishVersion(nextVersion);
  await cli(["start"], {
    ...AUTOUPDATE_ENV,
    npm_config_prefix: "/proc/1",
    npm_config_fetch_retries: "0",
    npm_config_fetch_retry_mintimeout: "1",
    npm_config_fetch_retry_maxtimeout: "1",
  });
  await expect.poll(() => healthJson()).toMatchObject({ status: "ok" });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect(await healthJson()).toMatchObject({ status: "ok" });

  const result = await cli(["--version"]);
  expect(result.stdout.trim()).toBe(currentVersion);
});
