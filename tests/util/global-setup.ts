import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const REGISTRY_URL = "http://localhost:4873";

function runCommand(
  command: string,
  arguments_: string[],
  options: { cwd?: string } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed: ${command} ${arguments_.join(" ")}\n` +
            `Exit code: ${String(code)}\n` +
            `stdout:\n${stdout}\n` +
            `stderr:\n${stderr}`,
        ),
      );
    });
  });
}

export default async function globalSetup(): Promise<void> {
  await rm(".verdaccio", { recursive: true, force: true });

  const publishArguments = [
    "publish",
    "--no-git-checks",
    "--access",
    "public",
    "--registry",
    REGISTRY_URL,
  ];

  await runCommand("pnpm", publishArguments, { cwd: "packages/runtime" });
  await runCommand("pnpm", publishArguments, { cwd: "packages/cli" });

  await runCommand("npm", ["i", "--no-save", "--registry", REGISTRY_URL, "@domovoid/cli@latest"], {
    cwd: "test-sandbox",
  });
}
