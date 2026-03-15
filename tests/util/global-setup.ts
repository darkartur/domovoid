import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { publishPackage } from "./verdaccio.ts";

const REGISTRY_URL = "http://localhost:4873";

import { spawn } from "node:child_process";

export default async function globalSetup(): Promise<void> {
  await rm(".verdaccio", { recursive: true, force: true });

  const require = createRequire(import.meta.url);
  const { version } = require("../../packages/cli/package.json") as { version: string };
  await publishPackage({
    sourcePath: "packages/runtime",
    versionOverride: version,
    registryUrl: REGISTRY_URL,
  });
  await publishPackage({
    sourcePath: "packages/cli",
    versionOverride: version,
    dependencyOverrides: { "@domovoid/runtime": version },
    registryUrl: REGISTRY_URL,
  });

  await runCommand("npm", ["i", "--no-save", "--registry", REGISTRY_URL, "@domovoid/cli@latest"], {
    cwd: "test-sandbox",
  });
}

function runCommand(
  command: string,
  arguments_: string[],
  options: { cwd?: string } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed: ${command} ${arguments_.join(" ")}\n` +
            `Exit code: ${String(code)}\n` +
            `stdout:\n${stdout}\n` +
            `stderr:\n${stderr}`,
        ),
      );
    });
  });
}
