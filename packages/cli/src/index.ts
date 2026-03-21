#!/usr/bin/env node
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import startCommand from "./commands/start.ts";
import stopCommand from "./commands/stop.ts";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

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
      await startCommand();
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
