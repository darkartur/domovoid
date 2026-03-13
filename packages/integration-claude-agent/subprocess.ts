import { spawn } from "node:child_process";
import { readSync, readFileSync, existsSync } from "node:fs";

function readTokenFromFd(fd: number): string | undefined {
  try {
    const chunks: Buffer[] = [];
    const buf = Buffer.alloc(4096);
    let bytesRead: number;
    do {
      bytesRead = readSync(fd, buf);
      if (bytesRead > 0) chunks.push(buf.subarray(0, bytesRead));
    } while (bytesRead > 0);
    return chunks.length > 0 ? Buffer.concat(chunks).toString("utf8").trim() : undefined;
  } catch {
    return undefined;
  }
}

function readTokenFromFile(filePath: string): string | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    return readFileSync(filePath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

const tokenFdEnvironment = process.env["CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR"];
const tokenFileEnvironment = process.env["CLAUDE_SESSION_INGRESS_TOKEN_FILE"];
const cachedToken: string | undefined =
  process.env["CLAUDE_CODE_OAUTH_TOKEN"] ??
  (tokenFdEnvironment ? readTokenFromFd(Number(tokenFdEnvironment)) : undefined) ??
  (tokenFileEnvironment ? readTokenFromFile(tokenFileEnvironment) : undefined);

interface ClaudeResult {
  text: string;
}

interface ClaudeRunOptions {
  prompt: string;
  token?: string;
  repoCwd?: string;
}

export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeResult> {
  const { prompt, token, repoCwd } = options;

  // Prompt is sent via stdin to avoid arg-parsing conflicts with variadic options
  const flags = ["--print", "--output-format", "text", "--allowedTools", "Read,Glob,Grep,LS,Bash"];

  const environment: NodeJS.ProcessEnv = { ...process.env };
  delete environment["CLAUDECODE"]; // allow spawning claude from within a claude session
  delete environment["CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR"]; // token is resolved below
  const resolvedToken = token ?? cachedToken;
  if (resolvedToken) {
    environment["CLAUDE_CODE_OAUTH_TOKEN"] = resolvedToken;
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", flags, {
      // detached: own process group — survives SIGTERM sent to the parent's group
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
      cwd: repoCwd ?? process.cwd(),
      env: environment,
    });

    // Send prompt via stdin and close it
    child.stdin.end(prompt, "utf8");

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString();
        const stdout = Buffer.concat(stdoutChunks).toString();
        const detail = [stderr, stdout].filter(Boolean).join("\n");
        reject(
          new Error(`Claude CLI exited with code ${String(code)}${detail ? `\n${detail}` : ""}`),
        );
        return;
      }
      const text = Buffer.concat(stdoutChunks).toString().trim();
      resolve({ text });
    });

    child.on("error", (error: Error) => {
      reject(error);
    });
  });
}
