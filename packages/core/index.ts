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
  const timer = startAutoUpdateLoop(VERSION, registryUrl, restart);
  process.on("SIGTERM", () => {
    clearInterval(timer);
  });
}

startHealthCheckServer(VERSION, restart === undefined ? {} : { onUpdateInstalled: restart });
