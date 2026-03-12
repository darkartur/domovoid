import { parseArgs } from "node:util";
import v8 from "node:v8";
import { VERSION } from "../core/index.ts";
import { startAutoUpdateLoop } from "../core/autoupdate.ts";

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

    if (values.help === true) {
      process.stdout.write(
        "Usage: domovoid [options]\n\nOptions:\n  -h, --help     Show help\n  -v, --version  Show version\n",
      );
      return;
    }

    // Daemon mode
    const restart =
      process.env["DOMOVOID_NO_RESTART"] === "1"
        ? undefined
        : () => {
            process.exit(0);
          };

    const registryUrl = process.env["REGISTRY_URL"];
    if (registryUrl !== undefined) {
      const intervalMs = Number(process.env["DOMOVOID_UPDATE_INTERVAL_MS"]) || 3_600_000;
      const timer = startAutoUpdateLoop(VERSION, registryUrl, restart, intervalMs);
      process.on("SIGTERM", () => {
        v8.takeCoverage();
        clearInterval(timer);
      });
    }

    process.stdout.write("started\n");
  } catch (error) {
    process.stderr.write(`Error: ${String(error)}\n`);
    process.exitCode = 1;
  }
}

main();
