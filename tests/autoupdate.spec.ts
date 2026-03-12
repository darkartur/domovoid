import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "./fixtures.ts";

const execFileAsync = promisify(execFile);

const VERDACCIO = "http://localhost:4873";
const PACKAGE_SRC = path.resolve("packages/core");

/**
 * Packs @domovoid/core at the given version and publishes it to the local
 * verdaccio registry. Safe to call multiple times for the same version —
 * "already published" errors are silently ignored.
 */
async function publishToVerdaccio(version: string): Promise<void> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "domovoid-pack-"));
  try {
    // Copy source and stamp the desired version
    await fs.cp(PACKAGE_SRC, temporaryDirectory, { recursive: true });
    const packagePath = path.join(temporaryDirectory, "package.json");
    const package_ = JSON.parse(await fs.readFile(packagePath, "utf8")) as {
      version: string;
    };
    package_.version = version;
    await fs.writeFile(packagePath, JSON.stringify(package_, undefined, 2));

    // Pack to tarball
    const { stdout } = await execFileAsync("npm", ["pack", "--json"], {
      cwd: temporaryDirectory,
    });
    const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
    const tarball = path.join(temporaryDirectory, filename);

    // Write a temp .npmrc so npm doesn't complain about missing credentials
    const npmrc = path.join(temporaryDirectory, ".npmrc");
    await fs.writeFile(npmrc, `//localhost:4873/:_authToken=test-token\n`);

    // Publish — ignore "already published" errors so tests are idempotent
    try {
      await execFileAsync(
        "npm",
        ["publish", "--access", "public", "--registry", VERDACCIO, tarball],
        { env: { ...process.env, npm_config_userconfig: npmrc } },
      );
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes("previously published") && !message.includes("already present"))
        throw error;
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const BASE_ENV = {
  REGISTRY_URL: VERDACCIO,
  DOMOVOID_UPDATE_INTERVAL_MS: "100",
  DOMOVOID_NPM_REGISTRY: VERDACCIO,
};

// Tests share one verdaccio instance and run serially (workers: 1).
// Verdaccio state is cumulative: "no update" publishes only 0.1.0 first,
// then the update suites add 0.2.0.

// Runs before any package is published so npm view returns an error,
// which exercises the transient-error catch handler in autoupdate.ts.
test.describe("registry error", () => {
  test.use({ appEnv: { ...BASE_ENV, DOMOVOID_NO_RESTART: "1" } });

  test("app stays alive after a transient registry error", async ({ app }) => {
    // Wait for at least one poll interval to fire and fail
    const ALIVE = Symbol("alive");
    const result = await Promise.race([
      app.exited.then(() => "exited" as const),
      new Promise<typeof ALIVE>((resolve) =>
        setTimeout(() => {
          resolve(ALIVE);
        }, 400),
      ),
    ]);
    expect(result).toBe(ALIVE);
  });
});

// No REGISTRY_URL — exercises the cli/index.ts branch where autoupdate is skipped.
// The daemon prints "started" and exits immediately (event loop empty).
test.describe("no registry", () => {
  test.use({ appEnv: { DOMOVOID_NO_RESTART: "1" } });

  test("starts and exits cleanly without a registry URL", async ({ app }) => {
    expect(await app.exited).toBe(0);
  });
});

// REGISTRY_URL set but DOMOVOID_UPDATE_INTERVAL_MS unset — exercises the
// `|| 3_600_000` default-interval branch.
test.describe("daemon with default update interval", () => {
  test.use({ appEnv: { REGISTRY_URL: VERDACCIO, DOMOVOID_NO_RESTART: "1" } });

  test.beforeAll(async () => {
    await publishToVerdaccio("0.1.0");
  });

  test("starts with the default one-hour interval", async ({ app }) => {
    // Daemon is running; the interval is 1 hour so no update fires during the test
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
    await publishToVerdaccio("0.1.0");
  });

  test("does not install anything", async ({ app }) => {
    // Wait for several check cycles — the interval is 100 ms
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
    await publishToVerdaccio("0.1.0");
    await publishToVerdaccio("0.2.0");
  });

  test("installs the new version under the prefix dir", async ({ app }) => {
    test.setTimeout(60_000);
    const moduleDirectory = path.join(
      app.prefixDirectory,
      "lib",
      "node_modules",
      "@domovoid",
      "core",
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

test.describe("update triggers restart", () => {
  test.use({ appEnv: { ...BASE_ENV } }); // no DOMOVOID_NO_RESTART

  test.beforeAll(async () => {
    await publishToVerdaccio("0.1.0");
    await publishToVerdaccio("0.2.0");
  });

  test("process exits with code 0 after installing update", async ({ app }) => {
    test.setTimeout(60_000);
    expect(await app.exited).toBe(0);
  });
});
