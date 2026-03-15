import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface PublishOptions {
  sourcePath: string;
  versionOverride?: string;
  dependencyOverrides?: Record<string, string>;
  registryUrl: string;
}

function runCommand(
  command: string,
  arguments_: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env ?? process.env,
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

function isAlreadyPublishedError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("previously published") ||
    lowered.includes("cannot publish over") ||
    lowered.includes("already exists") ||
    lowered.includes("epublishconflict")
  );
}

async function writeTemporaryNpmrc(
  directory: string,
  registryUrl: string,
): Promise<{ npmrcPath: string; npmrcEnv: NodeJS.ProcessEnv }> {
  const { host } = new URL(registryUrl);
  const npmrcPath = path.join(directory, ".npmrc");
  await fs.writeFile(npmrcPath, `//${host}/:_authToken=test-token\n`);
  return {
    npmrcPath,
    npmrcEnv: { ...process.env, npm_config_userconfig: npmrcPath },
  };
}

async function ensureDistribution(sourcePath: string): Promise<void> {
  const distributionPath = path.join(sourcePath, "dist");
  try {
    await fs.access(distributionPath);
  } catch {
    await runCommand("pnpm", ["-C", sourcePath, "run", "prepublishOnly"]);
  }
}

export async function publishPackage(options: PublishOptions): Promise<void> {
  const { sourcePath, versionOverride, dependencyOverrides, registryUrl } = options;
  await ensureDistribution(sourcePath);
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "domovoid-pack-"));
  try {
    await fs.cp(sourcePath, temporaryDirectory, { recursive: true });

    const packagePath = path.join(temporaryDirectory, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as {
      version: string;
      dependencies?: Record<string, string>;
    };

    if (versionOverride) packageJson.version = versionOverride;
    if (dependencyOverrides) {
      packageJson.dependencies = { ...packageJson.dependencies, ...dependencyOverrides };
    }
    await fs.writeFile(packagePath, JSON.stringify(packageJson, undefined, 2));

    const { npmrcEnv } = await writeTemporaryNpmrc(temporaryDirectory, registryUrl);

    try {
      await runCommand(
        "pnpm",
        [
          "publish",
          "--ignore-scripts",
          "--no-git-checks",
          "--access",
          "public",
          "--registry",
          registryUrl,
        ],
        { cwd: temporaryDirectory, env: npmrcEnv },
      );
    } catch (error) {
      const message = (error as Error).message;
      if (!isAlreadyPublishedError(message)) {
        throw error;
      }
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function publishRuntimeAndCli(version: string, registryUrl: string): Promise<void> {
  await publishPackage({ sourcePath: "packages/runtime", versionOverride: version, registryUrl });
  await publishPackage({
    sourcePath: "packages/cli",
    versionOverride: version,
    dependencyOverrides: { "@domovoid/runtime": version },
    registryUrl,
  });
}
