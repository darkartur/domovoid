import { test as base } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";

// ── CLI fixture (for cli.spec.ts) ────────────────────────────────────────────

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const CLI_ENTRY = nodePath.join(import.meta.dirname, "../packages/cli/index.ts");
const COVERAGE_DIR = nodePath.join(import.meta.dirname, "../coverage/tmp");

// ── App (daemon) fixture (for autoupdate.spec.ts) ────────────────────────────

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

export const test = base.extend<
  AppOptions & {
    app: AppFixture;
    cli: (arguments_: string[], environment?: Record<string, string>) => Promise<CliResult>;
  }
>({
  appEnv: [{}, { option: true }],

  cli: async ({}, use) => {
    await use(
      (arguments_, environment = {}) =>
        new Promise((resolve, reject) => {
          const child = spawn("node", [CLI_ENTRY, ...arguments_], {
            env: { ...process.env, NODE_V8_COVERAGE: COVERAGE_DIR, ...environment },
            shell: false,
          });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
          });
          child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });
          child.on("close", (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 1 });
          });
          child.on("error", reject);
        }),
    );
  },

  app: async ({ appEnv }, use) => {
    const prefixDirectory = await fs.mkdtemp(nodePath.join(os.tmpdir(), "domovoid-test-"));

    // detached: true puts the child in its own process group so we can
    // kill it together with any grandchildren (e.g. npm install)
    const proc = spawn("node", ["packages/cli/index.ts"], {
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
