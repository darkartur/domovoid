import { test as base } from "@playwright/test";
import { createRequire } from "node:module";
import nodePath from "node:path";
import { startDockerSession } from "../util/docker.ts";
import type { DockerSession } from "../util/docker.ts";
import { publishRuntimeAndCli, resetNpmPackages } from "../util/npm-registry.ts";
import { healthJson } from "../util/health.ts";

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

type CliFunction = (
  arguments_: string[],
  environment?: Record<string, string>,
) => Promise<CliResult>;

const COVERAGE_DIR = nodePath.join(import.meta.dirname, "../coverage/tmp");
const VERDACCIO_HOST_URL = "http://localhost:4873";

const require = createRequire(import.meta.url);
const { version: currentVersion } = require("../../packages/cli/package.json") as {
  version: string;
};

export const test = base.extend<{
  cli: CliFunction;
  publishVersion: (version: string) => Promise<void>;
  dockerSession: DockerSession;
}>({
  cli: async ({}, use) => {
    const session = await startDockerSession({
      packageVersion: currentVersion,
      hostCoverageDir: COVERAGE_DIR,
    });
    const invoke: CliFunction = (arguments_, environment = {}) =>
      session.exec(["domovoid", ...arguments_], {
        ...(session.containerCoveragePath
          ? { NODE_V8_COVERAGE: session.containerCoveragePath }
          : {}),
        ...environment,
      });

    await use(invoke);

    // Teardown: auto-stop daemon if running, then wait for port to be released
    if ((await healthJson()) !== undefined) {
      await invoke(["stop"]);
    }
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if ((await healthJson()) === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await session.stop();
  },

  publishVersion: async ({}, use) => {
    const published: string[] = [];
    await use(async (version: string) => {
      await publishRuntimeAndCli(version, VERDACCIO_HOST_URL);
      published.push(version);
    });
    if (published.some((v) => v !== currentVersion)) {
      await resetNpmPackages();
      await publishRuntimeAndCli(currentVersion, VERDACCIO_HOST_URL);
    }
  },
});

export { expect } from "@playwright/test";
