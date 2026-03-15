import { test as base } from "./base.ts";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";

// ── App (daemon) fixture (for autoupdate.spec.ts) ────────────────────────────

export interface AppFixture {
  /** Unique tmp dir auto-created and passed as DOMOVOID_NPM_PREFIX */
  prefixDirectory: string;
  /** Resolves with the exit code when the process exits */
  exited: Promise<number>;
}

interface AppOptions {
  /** Env vars merged on top of process.env when spawning the app */
  appEnv: NodeJS.ProcessEnv;
}

const COVERAGE_DIR = nodePath.join(import.meta.dirname, "../../coverage/tmp");

async function waitForStarted(proc: ChildProcess, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) reject(new Error(`App did not print "started" within ${String(timeoutMs)}ms`));
    }, timeoutMs);

    // stdout is always piped (stdio: ["ignore", "pipe", "inherit"])
    (proc.stdout as NodeJS.ReadableStream).on("data", (chunk: Buffer) => {
      if (!resolved && chunk.toString().includes("started")) {
        resolved = true;
        clearTimeout(timer);
        resolve();
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (!resolved) {
        reject(
          new Error(
            `App process closed with code ${String(code ?? "null")} before printing "started"`,
          ),
        );
      }
    });
  });
}

function killGroup(proc: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): void {
  // Kill the entire process group so spawned children (e.g. npm install) also exit.
  // SIGTERM lets the daemon flush V8 coverage before exiting; SIGKILL is used as a fallback.
  try {
    if (proc.pid !== undefined) process.kill(-proc.pid, signal);
  } catch {
    // Process may already have exited
  }
}

export const test = base.extend<AppOptions & { app: AppFixture }>({
  appEnv: [{}, { option: true }],

  app: async ({ appEnv }, use) => {
    const prefixDirectory = await fs.mkdtemp(nodePath.join(os.tmpdir(), "domovoid-test-"));

    // detached: true puts the child in its own process group so we can
    // kill it together with any grandchildren (e.g. npm install)
    // Run packages/cli/src/index.ts directly
    const proc = spawn("node", ["packages/cli/src/index.ts"], {
      env: {
        ...process.env,
        NODE_V8_COVERAGE: COVERAGE_DIR,
        DOMOVOID_NPM_PREFIX: prefixDirectory,
        ...appEnv,
      },
      // pipe stdout to capture the "started" readiness signal; inherit stderr
      stdio: ["ignore", "pipe", "inherit"],
      detached: true,
    });

    const exited = new Promise<number>((resolve) => proc.on("close", resolve));

    try {
      await waitForStarted(proc);
    } catch (error) {
      killGroup(proc, "SIGKILL");
      await exited;
      await fs.rm(prefixDirectory, { recursive: true, force: true });
      throw error;
    }

    await use({ prefixDirectory, exited });

    if (proc.exitCode === null) {
      // Send SIGTERM only to the daemon process (not the whole group) so any in-flight
      // npm subprocess can complete — its .then() callback must run for branch coverage.
      // SIGKILL the group as a fallback in case the daemon hangs.
      proc.kill("SIGTERM");
      const timeout = setTimeout(() => {
        killGroup(proc, "SIGKILL");
      }, 5000);
      await exited;
      clearTimeout(timeout);
    } else {
      await exited;
    }
    await fs.rm(prefixDirectory, { recursive: true, force: true });
  },
});

export { expect } from "@playwright/test";
