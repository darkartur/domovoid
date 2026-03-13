import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync, readSync, readFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

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
const claudeToken =
  process.env["CLAUDE_CODE_OAUTH_TOKEN"] ??
  (tokenFdEnvironment ? readTokenFromFd(Number(tokenFdEnvironment)) : undefined) ??
  (tokenFileEnvironment ? readTokenFromFile(tokenFileEnvironment) : undefined);

const DOMOVOID_DIR = path.resolve("./.domovoid");
process.env["DOMOVOID_DIR"] = DOMOVOID_DIR;

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 5000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
      env: {
        DOMOVOID_DIR,
        DOMOVOID_CONFIG: "./tests/domovoid-config.yml",
        ...(claudeToken ? { CLAUDE_CODE_OAUTH_TOKEN: claudeToken } : {}),
      },
    },
  ],
});
