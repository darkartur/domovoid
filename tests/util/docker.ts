import { execFile, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const IMAGE = "node:22-slim";

export interface DockerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerSession {
  /** Path inside the container where V8 coverage JSON files are written, or undefined when coverage is not configured. */
  readonly containerCoveragePath: string | undefined;
  exec(arguments_: string[], environment?: Record<string, string>): Promise<DockerExecResult>;
  stop(): Promise<void>;
}

const VERDACCIO_HOST_URL = "http://localhost:4873";

export async function startDockerSession(options: {
  packageVersion: string;
  /** Absolute path on the host to mount into the container for V8 coverage output. */
  hostCoverageDir?: string;
}): Promise<DockerSession> {
  // On Linux use --network=host so the container shares the host network namespace:
  //   - no iptables/NAT required for port mapping
  //   - container reaches Verdaccio via the same localhost URL as the host
  // On Mac, Docker Desktop runs containers in a VM so --network=host is not useful;
  // use port publishing (-p) and host.docker.internal for host-to-container comms.
  const useHostNetwork = process.platform !== "darwin";
  const containerRegistryUrl = useHostNetwork
    ? VERDACCIO_HOST_URL
    : VERDACCIO_HOST_URL.replace("localhost", "host.docker.internal");

  const { hostCoverageDir } = options;
  const containerCoveragePath = hostCoverageDir ? "/coverage" : undefined;

  if (hostCoverageDir) {
    await mkdir(hostCoverageDir, { recursive: true });
  }

  const runArguments = useHostNetwork
    ? ["run", "-d", "--network", "host"]
    : ["run", "-d", "-p", "7777:7777"];
  if (hostCoverageDir) {
    runArguments.push("-v", `${hostCoverageDir}:/coverage`);
  }
  runArguments.push(IMAGE, "sleep", "infinity");

  const { stdout: containerOutput } = await execFileAsync("docker", runArguments);
  const id = containerOutput.trim();

  // Install the CLI package and configure npm to use the Verdaccio registry
  await execFileAsync("docker", [
    "exec",
    id,
    "npm",
    "install",
    "-g",
    `@domovoid/cli@${options.packageVersion}`,
    "--registry",
    containerRegistryUrl,
  ]);
  await execFileAsync("docker", [
    "exec",
    id,
    "npm",
    "config",
    "set",
    "registry",
    containerRegistryUrl,
  ]);

  return {
    containerCoveragePath,
    exec(
      arguments_: string[],
      environment: Record<string, string> = {},
    ): Promise<DockerExecResult> {
      const environmentArguments = Object.entries(environment).flatMap(([k, v]) => [
        "-e",
        `${k}=${v}`,
      ]);
      return new Promise((resolve) => {
        const child = spawn("docker", ["exec", ...environmentArguments, id, ...arguments_], {
          stdio: ["ignore", "pipe", "pipe"],
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
      });
    },
    async stop(): Promise<void> {
      if (hostCoverageDir) {
        await execFileAsync("docker", ["exec", id, "chmod", "-R", "a+rw", "/coverage"]).catch(
          (error: unknown) => error,
        );
      }
      await execFileAsync("docker", ["rm", "-f", id]);
    },
  };
}
