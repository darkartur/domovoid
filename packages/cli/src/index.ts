#!/usr/bin/env node
import { parseArgs } from "node:util";
import { VERSION } from "@domovoid/runtime";
import startCommand from "./commands/start.js";
import stopCommand from "./commands/stop.js";

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
