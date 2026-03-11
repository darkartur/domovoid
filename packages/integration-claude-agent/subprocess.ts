import { spawn } from "node:child_process";

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
  if (token) {
    environment["CLAUDE_CODE_OAUTH_TOKEN"] = token;
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
        reject(
          new Error(`Claude CLI exited with code ${String(code)}${stderr ? `\n${stderr}` : ""}`),
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
