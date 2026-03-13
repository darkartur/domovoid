import { rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { VERSION } from "@domovoid/runtime";

const DAEMON_ENTRY = nodePath.join(import.meta.dirname, "../../runtime/daemon.ts");
const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");

async function startCommand(): Promise<void> {
  const child = spawn("node", ["--conditions=development", DAEMON_ENTRY], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  const { pid } = child;
  if (pid === undefined) {
    throw new Error("Failed to start daemon: could not get PID");
  }

  await writeFile(PID_FILE, String(pid));
  process.stdout.write(`Daemon started (PID ${String(pid)})\n`);
}

async function stopCommand(): Promise<void> {
  const content = await readFile(PID_FILE, "utf8");
  const pid = Number.parseInt(content.trim(), 10);
  if (Number.isNaN(pid)) {
    throw new TypeError("Invalid PID in file");
  }

  process.kill(pid);
  await rm(PID_FILE, { force: true });
  process.stdout.write(`Daemon stopped (PID ${String(pid)})\n`);
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
      process.stdout.write(`${VERSION}\n`);
      return;
    }

    const [subcommand] = positionals;

    if (subcommand === "start") {
      await startCommand();
      return;
    }

    if (subcommand === "stop") {
      await stopCommand();
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
