import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import nodePath from "node:path";
import { test, expect } from "./fixtures/base.ts";
import { publishRuntimeAndCli } from "./util/verdaccio.ts";
import { startDockerSession } from "./util/docker.ts";
import type { DockerSession } from "./util/docker.ts";

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

function containerUpdateEnvironment(session: DockerSession): Record<string, string> {
  return {
    REGISTRY_URL: session.containerRegistryUrl,
    DOMOVOID_UPDATE_INTERVAL_MS: "100",
    DOMOVOID_NPM_REGISTRY: session.containerRegistryUrl,
  };
}

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

async function publishVersions(versions: string[], registryUrl = REGISTRY_URL): Promise<void> {
  for (const version of versions) {
    await publishRuntimeAndCli(version, registryUrl);
  }
}

const PACKAGE_JSON_PATH = "/usr/local/lib/node_modules/@domovoid/cli/package.json";
const LOCAL_GLOBAL_MODULES = execFileSync("npm", ["root", "-g"]).toString().trim();
const LOCAL_CLI_PACKAGE_JSON = nodePath.join(LOCAL_GLOBAL_MODULES, "@domovoid/cli/package.json");

async function getInstalledVersion(session: DockerSession): Promise<string | undefined> {
  const result = await session.exec(["cat", PACKAGE_JSON_PATH]);
  if (result.exitCode !== 0) return undefined;
  try {
    return (JSON.parse(result.stdout) as { version: string }).version;
  } catch {
    return undefined;
  }
}

async function getLocalInstalledVersion(): Promise<string | undefined> {
  try {
    const content = await readFile(LOCAL_CLI_PACKAGE_JSON, "utf8");
    return (JSON.parse(content) as { version: string }).version;
  } catch {
    return undefined;
  }
}

test.use({ cliPath: "." });
test.describe.configure({ mode: "serial" });

test.describe("no update available", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion]);
  });

  test("daemon keeps running when already on latest version (local)", async ({ cli }) => {
    test.setTimeout(10_000);
    try {
      await cli(["start"], {
        REGISTRY_URL,
        DOMOVOID_UPDATE_INTERVAL_MS: "100",
        DOMOVOID_NO_RESTART: "1",
      });
      await expect.poll(() => healthStatus()).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await healthStatus()).toBe(200);
    } finally {
      await cli(["stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
    }
  });

  test("daemon keeps running when already on latest version", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], {
        ...containerUpdateEnvironment(session),
        DOMOVOID_NO_RESTART: "1",
      });
      await expect.poll(() => healthStatus()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(await healthStatus()).toBe(200);
      expect(await getInstalledVersion(session)).toBe(currentVersion);
    } finally {
      await session.exec(["domovoid", "stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
      await session.stop();
    }
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

  test("daemon installs the new version globally (local)", async ({ cli }) => {
    test.setTimeout(120_000);
    try {
      await cli(["start"], {
        REGISTRY_URL,
        DOMOVOID_UPDATE_INTERVAL_MS: "100",
        DOMOVOID_NPM_REGISTRY: REGISTRY_URL,
        DOMOVOID_NO_RESTART: "1",
      });
      await expect.poll(() => healthStatus()).toBe(200);
      await expect.poll(getLocalInstalledVersion, { timeout: 60_000 }).toBe(nextVersion);
    } finally {
      await cli(["stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
    }
  });

  test("daemon installs the new version globally", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], {
        ...containerUpdateEnvironment(session),
        DOMOVOID_NO_RESTART: "1",
      });
      await expect.poll(() => healthStatus()).toBe(200);

      await expect
        .poll(() => getInstalledVersion(session), {
          timeout: 240_000,
          message: "Expected installed version to be nextVersion after update",
        })
        .toBe(nextVersion);
    } finally {
      await session.exec(["domovoid", "stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
      await session.stop();
    }
  });

  test("installed package reports the new version", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], {
        ...containerUpdateEnvironment(session),
        DOMOVOID_NO_RESTART: "1",
      });
      await expect.poll(() => healthStatus()).toBe(200);

      await expect
        .poll(() => getInstalledVersion(session), {
          timeout: 240_000,
          message: "Expected installed version to equal nextVersion",
        })
        .toBe(nextVersion);
    } finally {
      await session.exec(["domovoid", "stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
      await session.stop();
    }
  });
});

test.describe("update triggers restart", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("daemon exits with code 0 after update (local)", async ({ cli }) => {
    test.setTimeout(120_000);
    await cli(["start"], {
      REGISTRY_URL,
      DOMOVOID_UPDATE_INTERVAL_MS: "100",
      DOMOVOID_NPM_REGISTRY: REGISTRY_URL,
    });
    await expect.poll(() => healthStatus()).toBe(200);
    await expect.poll(() => healthStatus(), { timeout: 60_000 }).toBeUndefined();
  });

  test("daemon exits with code 0 and update is installed", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], { ...containerUpdateEnvironment(session) });
      await expect.poll(() => healthStatus()).toBe(200);

      await expect
        .poll(() => healthStatus(), {
          timeout: 240_000,
          message: "Daemon should exit after installing update",
        })
        .toBeUndefined();

      expect(await getInstalledVersion(session)).toBe(nextVersion);
    } finally {
      await session.stop();
    }
  });
});

test.describe("installed CLI binary", () => {
  test.beforeAll(async () => {
    await publishVersions([currentVersion, nextVersion]);
  });

  test("installed CLI binary reports the new version", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], { ...containerUpdateEnvironment(session) });
      await expect.poll(() => healthStatus()).toBe(200);
      await expect.poll(() => healthStatus(), { timeout: 240_000 }).toBeUndefined();

      await expect
        .poll(
          async () => {
            const result = await session.exec(["domovoid", "--version"]);
            if (result.exitCode !== 0) return;
            return result.stdout.trim();
          },
          { message: "New CLI binary should report nextVersion" },
        )
        .toBe(nextVersion);
    } finally {
      await session.stop();
    }
  });

  test("daemon restarted with new binary reports new version in health", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], { ...containerUpdateEnvironment(session) });
      await expect.poll(() => healthStatus()).toBe(200);
      await expect.poll(() => healthStatus(), { timeout: 240_000 }).toBeUndefined();

      await session.exec(["domovoid", "start"], {
        ...containerUpdateEnvironment(session),
        DOMOVOID_NO_RESTART: "1",
      });
      try {
        await expect.poll(() => healthStatus(), { timeout: 30_000 }).toBe(200);

        const response = await fetch(`http://127.0.0.1:${String(PORT)}/health`);
        const json = (await response.json()) as { status: string; version: string };
        expect(json.version).toBe(nextVersion);
      } finally {
        await session.exec(["domovoid", "stop"]);
        await expect.poll(() => healthStatus()).toBeUndefined();
      }
    } finally {
      await session.stop();
    }
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

  test("daemon keeps running when install fails", async () => {
    test.setTimeout(300_000);
    const session = await startDockerSession({
      packageVersion: currentVersion,
      registryUrl: REGISTRY_URL,
    });
    try {
      await session.exec(["domovoid", "start"], {
        ...containerUpdateEnvironment(session),
        DOMOVOID_NPM_REGISTRY: "http://localhost:5999",
        DOMOVOID_NO_RESTART: "1",
        ...FAST_FAIL_NPM_ENV,
      });
      await expect.poll(() => healthStatus()).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(await healthStatus()).toBe(200);
      expect(await getInstalledVersion(session)).toBe(currentVersion);
    } finally {
      await session.exec(["domovoid", "stop"]);
      await expect.poll(() => healthStatus()).toBeUndefined();
      await session.stop();
    }
  });
});
