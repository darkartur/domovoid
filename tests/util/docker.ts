import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const IMAGE = "node:22-slim";

export interface DockerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerSession {
  /** URL the container uses to reach the host registry (e.g. Verdaccio). */
  readonly containerRegistryUrl: string;
  exec(arguments_: string[], environment?: Record<string, string>): Promise<DockerExecResult>;
  stop(): Promise<void>;
}

export async function startDockerSession(options: {
  packageVersion: string;
  registryUrl: string;
}): Promise<DockerSession> {
  // On Linux use --network=host so the container shares the host network namespace:
  //   - no iptables/NAT required for port mapping
  //   - container reaches Verdaccio via the same localhost URL as the host
  // On Mac, Docker Desktop runs containers in a VM so --network=host is not useful;
  // use port publishing (-p) and host.docker.internal for host-to-container comms.
  const useHostNetwork = process.platform !== "darwin";
  const containerRegistryUrl = useHostNetwork
    ? options.registryUrl
    : options.registryUrl.replace("localhost", "host.docker.internal");

  const runArguments = useHostNetwork
    ? ["run", "-d", "--network", "host"]
    : ["run", "-d", "-p", "7777:7777"];
  runArguments.push(IMAGE, "sleep", "infinity");

  const { stdout: containerOutput } = await execFileAsync("docker", runArguments);
  const id = containerOutput.trim();

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

  return {
    containerRegistryUrl,
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
      await execFileAsync("docker", ["rm", "-f", id]);
    },
  };
}
