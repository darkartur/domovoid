#!/usr/bin/env node
import { startAutoUpdateLoop } from "./autoupdate.ts";
import { startHealthCheckServer } from "./health.ts";

export const VERSION = "0.1.0";

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
    clearInterval(timer);
  });
}

const port = Number(process.env["PORT"]) || 3000;
startHealthCheckServer({ port });
