import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "./fixtures/app.ts";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const REGISTRY_URL = "http://localhost:4873";
const CLI_SRC = path.resolve("packages/cli");
const RUNTIME_SRC = path.resolve("packages/runtime");

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

async function publishPackage(
  sourcePath: string,
  version: string,
  dependencyOverrides: Record<string, string> = {},
): Promise<void> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "domovoid-pack-"));
  try {
    await fs.cp(sourcePath, temporaryDirectory, { recursive: true });

    const packagePath = path.join(temporaryDirectory, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as {
      version: string;
      dependencies?: Record<string, string>;
      publishConfig?: Record<string, unknown>;
    };

    packageJson.version = version;
    packageJson.dependencies = { ...packageJson.dependencies, ...dependencyOverrides };
    delete packageJson.publishConfig;

    await fs.writeFile(packagePath, JSON.stringify(packageJson, undefined, 2));

    const { stdout } = await execFileAsync("npm", ["pack", "--json"], {
      cwd: temporaryDirectory,
    });
    const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
    const tarball = path.join(temporaryDirectory, filename);

    const npmrc = path.join(temporaryDirectory, ".npmrc");
    await fs.writeFile(npmrc, `//localhost:4873/:_authToken=test-token\n`);

    try {
      await execFileAsync(
        "npm",
        ["publish", "--access", "public", "--registry", REGISTRY_URL, tarball],
        { env: { ...process.env, npm_config_userconfig: npmrc } },
      );
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes("previously published") && !message.includes("already present")) {
        throw error;
      }
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function publishRuntimeAndCli(version: string): Promise<void> {
  await publishPackage(RUNTIME_SRC, version);
  await publishPackage(CLI_SRC, version, {
    "@domovoid/runtime": version,
  });
}

const BASE_ENV = {
  REGISTRY_URL,
  DOMOVOID_UPDATE_INTERVAL_MS: "100",
  DOMOVOID_NPM_REGISTRY: REGISTRY_URL,
};

test.use({ cliPath: "test-sandbox" });
test.describe.configure({ mode: "serial" });

// Runs against a bad registry URL so npm view fails, exercising the transient-error handler.
test.describe("registry error", () => {
  test.use({
    appEnv: {
      REGISTRY_URL: "http://localhost:5999",
      DOMOVOID_UPDATE_INTERVAL_MS: "100",
      DOMOVOID_NO_RESTART: "1",
      npm_config_fetch_retries: "0",
      npm_config_fetch_retry_mintimeout: "1",
      npm_config_fetch_retry_maxtimeout: "1",
    },
  });

  test("app stays alive after a transient registry error", async ({ app }) => {
    const ALIVE = Symbol("alive");
    const result = await Promise.race([
      app.exited.then(() => "exited" as const),
      new Promise<typeof ALIVE>((resolve) =>
        setTimeout(() => {
          resolve(ALIVE);
        }, 1000),
      ),
    ]);
    expect(result).toBe(ALIVE);
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
    await publishRuntimeAndCli(currentVersion);
  });

  test("starts with the default one-hour interval", async ({ app }) => {
    const ALIVE = Symbol("alive");
    const result = await Promise.race([
      app.exited.then(() => "exited" as const),
      new Promise<typeof ALIVE>((resolve) =>
        setTimeout(() => {
          resolve(ALIVE);
        }, 200),
      ),
    ]);
    expect(result).toBe(ALIVE);
  });
});

test.describe("no update available", () => {
  test.use({ appEnv: { ...BASE_ENV, DOMOVOID_NO_RESTART: "1" } });

  test.beforeAll(async () => {
    await publishRuntimeAndCli(currentVersion);
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
  test.use({ appEnv: { ...BASE_ENV, DOMOVOID_NO_RESTART: "1" } });

  test.beforeAll(async () => {
    await publishRuntimeAndCli(currentVersion);
    await publishRuntimeAndCli(nextVersion);
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
      REGISTRY_URL,
      DOMOVOID_UPDATE_INTERVAL_MS: "100",
      DOMOVOID_NPM_REGISTRY: "http://localhost:5999",
      DOMOVOID_NO_RESTART: "1",
    },
  });

  test.beforeAll(async () => {
    await publishRuntimeAndCli(currentVersion);
    await publishRuntimeAndCli(nextVersion);
  });

  test("app stays alive after a transient install error", async ({ app }) => {
    test.setTimeout(60_000);
    const ALIVE = Symbol("alive");
    const result = await Promise.race([
      app.exited.then(() => "exited" as const),
      new Promise<typeof ALIVE>((resolve) =>
        setTimeout(() => {
          resolve(ALIVE);
        }, 800),
      ),
    ]);
    expect(result).toBe(ALIVE);
  });
});

test.describe("update triggers restart", () => {
  test.use({ appEnv: { ...BASE_ENV } });

  test.beforeAll(async () => {
    await publishRuntimeAndCli(currentVersion);
    await publishRuntimeAndCli(nextVersion);
  });

  test("process exits with code 0 after installing update", async ({ app }) => {
    test.setTimeout(60_000);
    expect(await app.exited).toBe(0);
  });
});
