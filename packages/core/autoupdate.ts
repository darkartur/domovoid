import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PACKAGE_NAME = "@domovoid/core";
const ENCODED_PACKAGE_NAME = PACKAGE_NAME.replace("/", "%2F");

async function checkForUpdate(
  currentVersion: string,
  registryUrl: string,
): Promise<{ updateAvailable: boolean; latest: string; current: string }> {
  const response = await fetch(`${registryUrl}/${ENCODED_PACKAGE_NAME}/latest`);
  if (!response.ok) {
    throw new Error(`Registry returned ${String(response.status)}`);
  }
  const { version: latest } = (await response.json()) as { version: string };
  return { updateAvailable: latest !== currentVersion, latest, current: currentVersion };
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
    void checkForUpdate(currentVersion, registryUrl)
      .then(async (result) => {
        if (!result.updateAvailable) return;
        installing = true;
        await performUpdate(result.latest);
        onUpdateInstalled?.();
      })
      .catch(() => {
        // Transient error (registry or install); reset and retry on next interval
        installing = false;
      });
  }, intervalMs);
}
