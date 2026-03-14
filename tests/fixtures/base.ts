import { test as base } from "@playwright/test";
import { spawn } from "node:child_process";
import nodePath from "node:path";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const CLI_PATH = process.env["CLI_PATH"];

const COVERAGE_DIR = nodePath.join(import.meta.dirname, "../coverage/tmp");

export const test = base.extend<{
  cli: (arguments_: string[], environment?: Record<string, string>) => Promise<CliResult>;
}>({
  cli: async ({}, use) => {
    await use(
      (arguments_, environment = {}) =>
        new Promise((resolve, reject) => {
          const cliPath = CLI_PATH
            ? nodePath.resolve(CLI_PATH, "node_modules/.bin/domovoid")
            : "domovoid";
          const child = spawn(cliPath, [...arguments_], {
            cwd: CLI_PATH,
            env: {
              ...process.env,
              NODE_V8_COVERAGE: COVERAGE_DIR,
              ...environment,
            },
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
});

export { expect } from "@playwright/test";
