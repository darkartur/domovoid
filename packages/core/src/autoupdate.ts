import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PACKAGE_NAME = "@domovoid/core";

async function getLatestVersion(registryUrl: string): Promise<string> {
  const { stdout } = await execFileAsync("npm", [
    "view",
    PACKAGE_NAME,
    "version",
    "--registry",
    registryUrl,
  ]);
  return stdout.trim();
}

async function performUpdate(version: string): Promise<void> {
  const arguments_ = ["install", "-g", `${PACKAGE_NAME}@${version}`];
  const registry = process.env["DOMOVOID_NPM_REGISTRY"];
  const prefix = process.env["DOMOVOID_NPM_PREFIX"];
  if (registry) arguments_.push("--registry", registry);
  if (prefix) arguments_.push("--prefix", prefix);
  await execFileAsync("npm", arguments_);
}

export function startAutoUpdateLoop(
  currentVersion: string,
  registryUrl: string,
  onUpdateInstalled: (() => void) | undefined,
  intervalMs = 3_600_000,
): NodeJS.Timeout {
  let installing = false;
  return setInterval(() => {
    if (installing) return;
    void getLatestVersion(registryUrl)
      .then(async (latest) => {
        if (latest === currentVersion) return;
        installing = true;
        await performUpdate(latest);
        onUpdateInstalled?.();
      })
      .catch(() => {
        // Transient error (registry or install); retry on next interval
        installing = false;
      });
  }, intervalMs);
}
