import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = "@domovoid/cli";

interface AutoUpdateOptions {
  currentVersion: string;
  registryUrl: string;
  intervalMs?: number;
  onUpdateInstalled?: (() => void) | undefined;
}

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

async function performUpdate(targetVersion: string): Promise<void> {
  const arguments_ = ["install", "-g", `${PACKAGE_NAME}@${targetVersion}`];
  const registry = process.env["DOMOVOID_NPM_REGISTRY"];
  const prefix = process.env["DOMOVOID_NPM_PREFIX"];
  if (registry) arguments_.push("--registry", registry);
  if (prefix) arguments_.push("--prefix", prefix);
  await execFileAsync("npm", arguments_);
}

export function startAutoUpdateLoop(options: AutoUpdateOptions): NodeJS.Timeout {
  const { currentVersion, registryUrl, intervalMs = 3_600_000, onUpdateInstalled } = options;
  let installing = false;
  const tick = (): void => {
    if (installing) return;
    void getLatestVersion(registryUrl)
      .then(async (latest) => {
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
