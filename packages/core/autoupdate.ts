import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PACKAGE_NAME = "@domovoid/core";
const ENCODED_PACKAGE_NAME = PACKAGE_NAME.replace("/", "%2F");

export async function checkForUpdate(
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

export async function performUpdate(version: string): Promise<void> {
  const mockBin = process.env["DOMOVOID_NPM_BIN"];
  await (mockBin === undefined
    ? execFileAsync("npm", ["install", "-g", `${PACKAGE_NAME}@${version}`])
    : execFileAsync("node", [mockBin, "install", "-g", `${PACKAGE_NAME}@${version}`]));
}

export function startAutoUpdateLoop(
  currentVersion: string,
  registryUrl: string,
  onUpdateInstalled: (() => void) | undefined,
  intervalMs = 3_600_000,
): NodeJS.Timeout {
  return setInterval(() => {
    void checkForUpdate(currentVersion, registryUrl)
      .then(async (result) => {
        if (result.updateAvailable) {
          await performUpdate(result.latest);
          onUpdateInstalled?.();
        }
      })
      .catch(() => {
        // Transient registry error; will retry on next interval
      });
  }, intervalMs);
}
