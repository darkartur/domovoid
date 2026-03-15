import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "./fixtures/app.ts";
import { publishRuntimeAndCli } from "./util/verdaccio.ts";

const require = createRequire(import.meta.url);

const REGISTRY_URL = "http://localhost:4873";
const { version: currentVersion } = require("../packages/cli/package.json") as {
  version: string;
};

function bumpPatch(version: string): string {
  const [major, minor, patch, ...rest] = version.split(".");
  if (major === undefined || minor === undefined || patch === undefined || rest.length > 0) {
    throw new TypeError(`Unexpected version format: ${version}`);
  }
  const nextPatch = Number(patch) + 1;
  if (!Number.isFinite(nextPatch)) {
    throw new TypeError(`Unexpected version format: ${version}`);
  }
  return `${major}.${minor}.${String(nextPatch)}`;
}

const nextVersion = bumpPatch(currentVersion);

const DEFAULT_UPDATE_ENV = {
  REGISTRY_URL,
  DOMOVOID_UPDATE_INTERVAL_MS: "100",
  DOMOVOID_NPM_REGISTRY: REGISTRY_URL,
};

const FAST_FAIL_NPM_ENV = {
  npm_config_fetch_retries: "0",
  npm_config_fetch_retry_mintimeout: "1",
  npm_config_fetch_retry_maxtimeout: "1",
};

function createUpdateEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  return { ...DEFAULT_UPDATE_ENV, ...overrides };
}

async function publishVersions(versions: string[], registryUrl = REGISTRY_URL): Promise<void> {
  for (const version of versions) {
    await publishRuntimeAndCli(version, registryUrl);
  }
}

async function expectProcessAlive(
  exited: Promise<number>,
  durationMs: number,
): Promise<void> {
  const ALIVE = Symbol("alive");
  const result = await Promise.race([
    exited.then(() => "exited" as const),
    new Promise<typeof ALIVE>((resolve) =>
      setTimeout(() => {
        resolve(ALIVE);
      }, durationMs),
    ),
  ]);
  expect(result).toBe(ALIVE);
}

test.use({ cliPath: "test-sandbox" });
test.describe.configure({ mode: "serial" });

test.describe("source coverage", () => {
  test.use({
    cliPath: ".",
    appEnv: {
      REGISTRY_URL: "http://localhost:5999",
      DOMOVOID_UPDATE_INTERVAL_MS: "100",
      DOMOVOID_NO_RESTART: "1",
      ...FAST_FAIL_NPM_ENV,
    },
  });

  test("covers the autoupdate loop in source CLI", async ({ app }) => {
    expect(app).toBeDefined();
    await expectProcessAlive(app.exited, 1000);
  });
});

test.describe("source no update available", () => {
  test.use({
    cliPath: ".",
    appEnv: createUpdateEnvironment({ DOMOVOID_NO_RESTART: "1" }),
  });

  test.beforeAll(async () => {
    await publishVersions([currentVersion]);
  });

  test("stays alive when latest version matches current in source CLI", async ({ app }) => {
    expect(app).toBeDefined();
    test.setTimeout(10_000);
    await expectProcessAlive(app.exited, 3000);
  });
});

// Runs against a bad registry URL so npm view fails, exercising the transient-error handler.
test.describe("registry error", () => {
  test.use({
    appEnv: {
      REGISTRY_URL: "http://localhost:5999",
      DOMOVOID_UPDATE_INTERVAL_MS: "100",
      DOMOVOID_NO_RESTART: "1",
      ...FAST_FAIL_NPM_ENV,
    },
  });

  test("app stays alive after a transient registry error", async ({ app }) => {
    expect(app).toBeDefined();
    await expectProcessAlive(app.exited, 1000);
  });
});

// No REGISTRY_URL — exercises the cli branch where autoupdate is skipped.
// The daemon prints "started" and exits immediately (event loop empty).
test.describe("no registry", () => {
  test.use({ appEnv: { DOMOVOID_NO_RESTART: "1" } });

  test("starts and exits cleanly without a registry URL", async ({ app }) => {
    expect(await app.exited).toBe(0);
  });
});

// REGISTRY_URL set but DOMOVOID_UPDATE_INTERVAL_MS unset — exercises the default-interval branch.
test.describe("daemon with default update interval", () => {
  test.use({ appEnv: { REGISTRY_URL, DOMOVOID_NO_RESTART: "1" } });

  test.beforeAll(async () => {
    await publishVersions([currentVersion]);
  });

  test("starts with the default one-hour interval", async ({ app }) => {
    expect(app).toBeDefined();
    await expectProcessAlive(app.exited, 200);
  });
});

test.describe("no update available", () => {
  test.use({ appEnv: createUpdateEnvironment({ DOMOVOID_NO_RESTART: "1" }) });

  test.beforeAll(async () => {
    await publishVersions([currentVersion]);
  });

  test("does not install anything", async ({ app }) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const libraryDirectory = path.join(app.prefixDirectory, "lib");
    expect(
      await fs
        .access(libraryDirectory)
        .then(() => true)
        .catch(() => false),
      `Expected ${libraryDirectory} to not exist`,
    ).toBe(false);
  });
});

test.describe("update available", () => {
  test.use({ appEnv: createUpdateEnvironment({ DOMOVOID_NO_RESTART: "1" }) });

  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("installs the new version under the prefix dir", async ({ app }) => {
    test.setTimeout(60_000);
    const moduleDirectory = path.join(
      app.prefixDirectory,
      "lib",
      "node_modules",
      "@domovoid",
      "cli",
    );
    await expect
      .poll(
        async () =>
          fs
            .access(moduleDirectory)
            .then(() => true)
            .catch(() => false),
        { timeout: 30_000, message: `Expected ${moduleDirectory} to exist after update` },
      )
      .toBe(true);
  });
});

test.describe("update install failure", () => {
  test.use({
    appEnv: {
      ...createUpdateEnvironment(),
      DOMOVOID_NPM_REGISTRY: "http://localhost:5999",
      DOMOVOID_NO_RESTART: "1",
    },
  });

  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("app stays alive after a transient install error", async ({ app }) => {
    expect(app).toBeDefined();
    test.setTimeout(60_000);
    await expectProcessAlive(app.exited, 800);
  });
});

test.describe("update triggers restart", () => {
  test.use({ appEnv: createUpdateEnvironment() });

  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("process exits with code 0 after installing update", async ({ app }) => {
    test.setTimeout(60_000);
    expect(await app.exited).toBe(0);
  });
});

test.describe("source update restart", () => {
  test.use({ cliPath: ".", appEnv: createUpdateEnvironment() });

  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("exits after installing update in source CLI", async ({ app }) => {
    test.setTimeout(60_000);
    expect(await app.exited).toBe(0);
  });
});
