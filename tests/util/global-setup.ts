import { createRequire } from "node:module";
import { publishRuntimeAndCli, resetNpmPackages } from "./npm-registry.ts";

const VERDACCIO_HOST_URL = "http://localhost:4873";
const require = createRequire(import.meta.url);
const { version } = require("../../packages/cli/package.json") as { version: string };

export default async function globalSetup(): Promise<void> {
  await resetNpmPackages();
  await publishRuntimeAndCli(version, VERDACCIO_HOST_URL);
}
