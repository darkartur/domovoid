import { parseArgs } from "node:util";
import { VERSION } from "@domovoid/core";

function main(): void {
  try {
    const { values } = parseArgs({
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });

    if (values.version === true) {
      process.stdout.write(`${VERSION}\n`);
      return;
    }

    process.stdout.write(
      "Usage: domovoid [options]\n\nOptions:\n  -h, --help     Show help\n  -v, --version  Show version\n",
    );
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exitCode = 1;
  }
}

main();
