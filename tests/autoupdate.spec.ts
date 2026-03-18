import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "./fixtures/base.ts";
import { publishRuntimeAndCli } from "./util/verdaccio.ts";

const PORT = 7777;
const REGISTRY_URL = "http://localhost:4873";
const require = createRequire(import.meta.url);
const { version: currentVersion } = require("../packages/runtime/package.json") as {
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

const BASE_UPDATE_ENV = {
  REGISTRY_URL,
  DOMOVOID_UPDATE_INTERVAL_MS: "100",
  DOMOVOID_NPM_REGISTRY: REGISTRY_URL,
};

const FAST_FAIL_NPM_ENV = {
  npm_config_fetch_retries: "0",
  npm_config_fetch_retry_mintimeout: "1",
  npm_config_fetch_retry_maxtimeout: "1",
};

async function healthStatus(): Promise<number | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(PORT)}/health`);
    return response.status;
  } catch {
    return undefined;
  }
}

async function withPrefixDirectory<T>(
  function_: (prefixDirectory: string) => Promise<T>,
): Promise<T> {
  const prefixDirectory = await fs.mkdtemp(nodePath.join(tmpdir(), "domovoid-test-"));
  try {
    return await function_(prefixDirectory);
  } finally {
    await fs.rm(prefixDirectory, { recursive: true, force: true });
  }
}

async function publishVersions(versions: string[], registryUrl = REGISTRY_URL): Promise<void> {
  for (const version of versions) {
    await publishRuntimeAndCli(version, registryUrl);
  }
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runBin(
  binPath: string,
  arguments_: string[],
  environment: Record<string, string> = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, arguments_, {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

test.use({ cliPath: "." });
test.describe.configure({ mode: "serial" });

test.describe("no update available", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion]);
  });

  test("daemon keeps running when already on latest version", async ({ cli }) => {
    test.setTimeout(10_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      try {
        await cli(["start"], {
          ...BASE_UPDATE_ENV,
          DOMOVOID_NO_RESTART: "1",
          DOMOVOID_NPM_PREFIX: prefixDirectory,
        });
        await expect.poll(() => healthStatus()).toBe(200);

        await new Promise((resolve) => setTimeout(resolve, 3000));

        expect(await healthStatus()).toBe(200);

        const libraryDirectory = nodePath.join(prefixDirectory, "lib");
        expect(
          await fs
            .access(libraryDirectory)
            .then(() => true)
            .catch(() => false),
        ).toBe(false);
      } finally {
        await cli(["stop"]);
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    });
  });
});

test.describe("no registry", () => {
  test("daemon runs without autoupdate when REGISTRY_URL is unset", async ({ cli }) => {
    test.setTimeout(5000);
    try {
      await cli(["start"], { DOMOVOID_NO_RESTART: "1" });
      await expect.poll(() => healthStatus()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(await healthStatus()).toBe(200);
    } finally {
      await cli(["stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
    }
  });
});

test.describe("update available", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("daemon installs the new version under the prefix dir", async ({ cli }) => {
    test.setTimeout(60_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      try {
        await cli(["start"], {
          ...BASE_UPDATE_ENV,
          DOMOVOID_NO_RESTART: "1",
          DOMOVOID_NPM_PREFIX: prefixDirectory,
        });
        await expect.poll(() => healthStatus()).toBe(200);

        const moduleDirectory = nodePath.join(
          prefixDirectory,
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
      } finally {
        await cli(["stop"]);
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    });
  });

  test("installed package reports the new version", async ({ cli }) => {
    test.setTimeout(60_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      try {
        await cli(["start"], {
          ...BASE_UPDATE_ENV,
          DOMOVOID_NO_RESTART: "1",
          DOMOVOID_NPM_PREFIX: prefixDirectory,
        });
        await expect.poll(() => healthStatus()).toBe(200);

        const packageJsonPath = nodePath.join(
          prefixDirectory,
          "lib",
          "node_modules",
          "@domovoid",
          "cli",
          "package.json",
        );
        await expect
          .poll(
            async () => {
              try {
                const content = await fs.readFile(packageJsonPath, "utf8");
                return (JSON.parse(content) as { version: string }).version;
              } catch {
                return;
              }
            },
            { timeout: 30_000, message: "Expected installed version to equal nextVersion" },
          )
          .toBe(nextVersion);
      } finally {
        await cli(["stop"]);
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    });
  });
});

test.describe("update triggers restart", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("daemon exits with code 0 and update is installed", async ({ cli }) => {
    test.setTimeout(60_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      await cli(["start"], { ...BASE_UPDATE_ENV, DOMOVOID_NPM_PREFIX: prefixDirectory });
      await expect.poll(() => healthStatus()).toBe(200);

      await expect
        .poll(() => healthStatus(), {
          timeout: 30_000,
          message: "Daemon should exit after installing update",
        })
        .toBeUndefined();

      const moduleDirectory = nodePath.join(
        prefixDirectory,
        "lib",
        "node_modules",
        "@domovoid",
        "cli",
      );
      expect(
        await fs
          .access(moduleDirectory)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
    });
  });
});

test.describe("installed CLI binary", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("installed CLI binary reports the new version", async ({ cli }) => {
    test.setTimeout(60_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      await cli(["start"], { ...BASE_UPDATE_ENV, DOMOVOID_NPM_PREFIX: prefixDirectory });
      await expect.poll(() => healthStatus()).toBe(200);
      await expect.poll(() => healthStatus(), { timeout: 30_000 }).toBeUndefined();

      const newBin = nodePath.join(prefixDirectory, "bin", "domovoid");
      await expect
        .poll(
          async () => {
            try {
              const result = await runBin(newBin, ["--version"]);
              return result.stdout.trim();
            } catch {
              return;
            }
          },
          { message: "New CLI binary should report nextVersion" },
        )
        .toBe(nextVersion);
    });
  });

  test("daemon restarted with new binary reports new version in health", async ({ cli }) => {
    test.setTimeout(60_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      await cli(["start"], { ...BASE_UPDATE_ENV, DOMOVOID_NPM_PREFIX: prefixDirectory });
      await expect.poll(() => healthStatus()).toBe(200);
      await expect.poll(() => healthStatus(), { timeout: 30_000 }).toBeUndefined();

      const newBin = nodePath.join(prefixDirectory, "bin", "domovoid");
      await runBin(newBin, ["start"], { ...BASE_UPDATE_ENV, DOMOVOID_NO_RESTART: "1" });
      try {
        await expect.poll(() => healthStatus()).toBe(200);

        const response = await fetch(`http://127.0.0.1:${String(PORT)}/health`);
        const json = (await response.json()) as { status: string; version: string };
        expect(json.version).toBe(nextVersion);
      } finally {
        await runBin(newBin, ["stop"], { ...BASE_UPDATE_ENV });
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    });
  });
});

test.describe("registry error", () => {
  test("daemon keeps running after a transient registry error", async ({ cli }) => {
    test.setTimeout(5000);
    try {
      await cli(["start"], {
        REGISTRY_URL: "http://localhost:5999",
        DOMOVOID_UPDATE_INTERVAL_MS: "100",
        DOMOVOID_NO_RESTART: "1",
        ...FAST_FAIL_NPM_ENV,
      });
      await expect.poll(() => healthStatus()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(await healthStatus()).toBe(200);
    } finally {
      await cli(["stop"]);
    }
  });
});

test.describe("install error", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("daemon keeps running when install fails", async ({ cli }) => {
    test.setTimeout(10_000);
    await withPrefixDirectory(async (prefixDirectory) => {
      try {
        await cli(["start"], {
          ...BASE_UPDATE_ENV,
          DOMOVOID_NPM_REGISTRY: "http://localhost:5999",
          DOMOVOID_NPM_PREFIX: prefixDirectory,
          DOMOVOID_NO_RESTART: "1",
          ...FAST_FAIL_NPM_ENV,
        });
        await expect.poll(() => healthStatus()).toBe(200);

        await new Promise((resolve) => setTimeout(resolve, 2000));
        expect(await healthStatus()).toBe(200);

        const moduleDirectory = nodePath.join(
          prefixDirectory,
          "lib",
          "node_modules",
          "@domovoid",
          "cli",
        );
        expect(
          await fs
            .access(moduleDirectory)
            .then(() => true)
            .catch(() => false),
        ).toBe(false);
      } finally {
        await cli(["stop"]);
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    });
  });
});
