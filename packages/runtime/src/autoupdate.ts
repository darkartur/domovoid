import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = "@domovoid/cli";

interface AutoUpdateOptions {
  currentVersion: string;
  intervalMs?: number;
  onUpdateInstalled?: (() => void) | undefined;
}

async function getLatestVersion(): Promise<string> {
  const { stdout } = await execFileAsync("npm", ["view", PACKAGE_NAME, "version"]);
  return stdout.trim();
}

async function performUpdate(targetVersion: string): Promise<void> {
  await execFileAsync("npm", ["install", "-g", `${PACKAGE_NAME}@${targetVersion}`]);
}

export function startAutoUpdateLoop(options: AutoUpdateOptions): NodeJS.Timeout {
  const { currentVersion, intervalMs = 3_600_000, onUpdateInstalled } = options;
  let installing = false;
  const tick = (): void => {
    if (installing) return;
    void getLatestVersion()
      .then(async (latest) => {
        if (installing) return;
        if (latest === currentVersion) return;
        installing = true;
        try {
          await performUpdate(latest);
        } finally {
          installing = false;
        }
        onUpdateInstalled?.();
      })
      .catch(() => {
        // Transient error (registry or install); retry on next interval
        installing = false;
      });
  };
  tick();
  return setInterval(tick, intervalMs);
}
