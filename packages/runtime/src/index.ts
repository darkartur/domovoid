import { createRequire } from "node:module";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { spawn } from "node:child_process";
import v8 from "node:v8";
import { startAutoUpdateLoop } from "./autoupdate.ts";

const PORT = 7777;
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const server = await new Promise<Server>((resolve, reject) => {
  const s = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version }));
  });
  s.on("error", reject);
  s.listen(PORT, () => {
    resolve(s);
  });
});

const shouldFlushCoverage = Boolean(process.env["NODE_V8_COVERAGE"]);
const flushCoverage = (): void => {
  if (shouldFlushCoverage) {
    v8.takeCoverage();
  }
};

const autoupdateEnabled = process.env["DOMOVOID_AUTOUPDATE"] === "1";
const intervalMs = Number(process.env["DOMOVOID_UPDATE_INTERVAL_MS"]) || 3_600_000;

let timer: NodeJS.Timeout | undefined;

const shutdown = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  server.closeAllConnections();
  server.close();
};

if (autoupdateEnabled) {
  timer = startAutoUpdateLoop({
    currentVersion: version,
    intervalMs,
    onUpdateInstalled: () => {
      flushCoverage();
      shutdown();
      const child = spawn("domovoid", ["start"], {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.unref();
    },
  });
}

process.on("SIGTERM", () => {
  flushCoverage();
  shutdown();
});
