import { createRequire } from "node:module";
import { createServer } from "node:http";
import type { Server } from "node:http";
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

const shouldRestart = process.env["DOMOVOID_NO_RESTART"] !== "1";
const shouldFlushCoverage = Boolean(process.env["NODE_V8_COVERAGE"]);
const flushCoverage = (): void => {
  if (shouldFlushCoverage) {
    v8.takeCoverage();
  }
};

const registryUrl = process.env["REGISTRY_URL"];
const intervalMs = Number(process.env["DOMOVOID_UPDATE_INTERVAL_MS"]) || 3_600_000;
const restart = shouldRestart
  ? () => {
      flushCoverage();
      server.closeAllConnections();
      server.close();
      // eslint-disable-next-line n/no-process-exit, unicorn/no-process-exit -- intentional restart signal
      process.exit(0);
    }
  : undefined;

const timer = registryUrl
  ? startAutoUpdateLoop({
      currentVersion: version,
      registryUrl,
      intervalMs,
      onUpdateInstalled: restart,
    })
  : undefined;

process.on("SIGTERM", () => {
  flushCoverage();
  if (timer) {
    clearInterval(timer);
  }
  server.closeAllConnections();
  server.close();
});
