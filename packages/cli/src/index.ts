#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import v8 from "node:v8";
import startCommand from "./commands/start.ts";
import stopCommand from "./commands/stop.ts";

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = "@domovoid/cli";
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

async function getLatestVersion(registryUrl: string): Promise<string> {
  const { stdout } = await execFileAsync("npm", [
    "view",
    PACKAGE_NAME,
    "version",
    "--registry",
    registryUrl,
  ]);
  return stdout.trim();
}

async function performUpdate(targetVersion: string): Promise<void> {
  const arguments_ = ["install", "-g", `${PACKAGE_NAME}@${targetVersion}`];
  const registry = process.env["DOMOVOID_NPM_REGISTRY"];
  const prefix = process.env["DOMOVOID_NPM_PREFIX"];
  if (registry) arguments_.push("--registry", registry);
  if (prefix) arguments_.push("--prefix", prefix);
  await execFileAsync("npm", arguments_);
}

function startAutoUpdateLoop(
  currentVersion: string,
  registryUrl: string,
  onUpdateInstalled: (() => void) | undefined,
  intervalMs = 3_600_000,
): NodeJS.Timeout {
  let installing = false;
  return setInterval(() => {
    if (installing) return;
    void getLatestVersion(registryUrl)
      .then(async (latest) => {
        if (latest === currentVersion) return;
        installing = true;
        try {
          await performUpdate(latest);
          onUpdateInstalled?.();
        } finally {
          installing = false;
        }
      })
      .catch(() => {
        // Transient error (registry or install); retry on next interval
        installing = false;
      });
  }, intervalMs);
}

async function main(): Promise<void> {
  try {
    const { values, positionals } = parseArgs({
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
    });

    if (values.version === true) {
      process.stdout.write(`${version}\n`);
      return;
    }

    const [subcommand] = positionals;

    if (values.help === true) {
      if (subcommand === "start") {
        process.stdout.write("Usage: domovoid start\n\nDescription:\n  Starts the daemon.\n");
        return;
      }
      if (subcommand === "stop") {
        process.stdout.write("Usage: domovoid stop\n\nDescription:\n  Stops the daemon.\n");
        return;
      }
    }

    if (subcommand === "start") {
      await startCommand();
      return;
    }

    if (subcommand === "stop") {
      await stopCommand();
      return;
    }

    if (!subcommand && values.help !== true) {
      const restart =
        process.env["DOMOVOID_NO_RESTART"] === "1"
          ? undefined
          : () => {
              v8.takeCoverage();
              process.exit(0);
            };

      const registryUrl = process.env["REGISTRY_URL"];
      if (registryUrl) {
        const intervalMs = Number(process.env["DOMOVOID_UPDATE_INTERVAL_MS"]) || 3_600_000;
        const timer = startAutoUpdateLoop(version, registryUrl, restart, intervalMs);
        process.on("SIGTERM", () => {
          v8.takeCoverage();
          clearInterval(timer);
        });
      }

      process.stdout.write("started\n");
      return;
    }

    process.stdout.write(
      "Usage: domovoid [options] [command]\n\nCommands:\n  start          Start the daemon\n  stop           Stop the daemon\n\nOptions:\n  -h, --help     Show help\n  -v, --version  Show version\n",
    );
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exitCode = 1;
  }
}

await main();
