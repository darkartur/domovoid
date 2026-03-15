import { rm } from "node:fs/promises";
import nodePath from "node:path";

const COVERAGE_TEMP_DIR = nodePath.resolve("tests/coverage/tmp");
const COVERAGE_REPORT_DIR = nodePath.resolve("coverage/html");

await rm(COVERAGE_TEMP_DIR, { recursive: true, force: true });
await rm(COVERAGE_REPORT_DIR, { recursive: true, force: true });
