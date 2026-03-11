import { test as base } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface AppFixture {
  url: string;
  /** Unique tmp dir auto-created and passed as DOMOVOID_NPM_PREFIX */
  prefixDirectory: string;
  /** Resolves with the exit code when the process exits */
  exited: Promise<number>;
}

interface AppOptions {
  /** Env vars merged on top of process.env when spawning the app */
  appEnv: NodeJS.ProcessEnv;
}

async function waitForHealth(url: string, proc: ChildProcess, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(
        `App process exited with code ${String(proc.exitCode)} before becoming healthy`,
      );
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`App at ${url} did not become healthy within ${String(timeoutMs)}ms`);
}

function killGroup(proc: ChildProcess): void {
  // Kill the entire process group so spawned children (e.g. npm install) also exit
  try {
    if (proc.pid !== undefined) process.kill(-proc.pid, "SIGKILL");
  } catch {
    // Process may already have exited
  }
}

export const test = base.extend<AppOptions & { app: AppFixture }>({
  appEnv: [{}, { option: true }],

  app: async ({ appEnv }, use) => {
    const prefixDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "domovoid-test-"));

    // detached: true puts the child in its own process group so we can
    // kill it together with any grandchildren (e.g. npm install)
    const proc = spawn("node", ["packages/core/index.ts"], {
      env: { ...process.env, DOMOVOID_NPM_PREFIX: prefixDirectory, ...appEnv },
      stdio: "inherit",
      detached: true,
    });

    const exited = new Promise<number>((resolve) => proc.on("close", resolve));

    const port = appEnv["PORT"] ?? "3000";
    const url = `http://localhost:${port}`;

    try {
      await waitForHealth(url, proc);
    } catch (error) {
      killGroup(proc);
      await exited;
      await fs.rm(prefixDirectory, { recursive: true, force: true });
      throw error;
    }

    await use({ url, prefixDirectory, exited });

    if (proc.exitCode === null) killGroup(proc);
    await exited;
    await fs.rm(prefixDirectory, { recursive: true, force: true });
  },
});

export { expect } from "@playwright/test";
