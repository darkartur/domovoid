#!/usr/bin/env node
import { startHealthCheckServer } from "./health.ts";

export const VERSION = "0.1.0";

startHealthCheckServer(VERSION);
