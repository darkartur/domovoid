import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

function parseOwnerRepo(repositoryUrl: string): { owner: string; name: string } {
  const pathParts = repositoryUrl
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);
  const owner = pathParts.at(-2);
  const name = pathParts.at(-1);
  if (!owner || !name) {
    throw new Error(`Cannot parse owner/repo from URL: ${repositoryUrl}`);
  }
  return { owner, name };
}

export async function ensureBaseClone(
  repositoryUrl: string,
  dataDirectory: string,
  token?: string,
): Promise<string> {
  const { owner, name } = parseOwnerRepo(repositoryUrl);
  const baseDirectory = path.join(dataDirectory, owner, name);
  const resolvedToken = token ?? process.env["GITHUB_TOKEN"] ?? "";
  const cloneUrl = `https://${resolvedToken ? `x-access-token:${resolvedToken}@` : ""}github.com/${owner}/${name}.git`;

  if (existsSync(path.join(baseDirectory, ".git"))) {
    await execFileAsync("git", ["-C", baseDirectory, "remote", "set-url", "origin", cloneUrl], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    await execFileAsync("git", ["-C", baseDirectory, "fetch", "--depth=1", "origin"], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } else {
    await mkdir(path.join(dataDirectory, owner), { recursive: true });
    await execFileAsync("git", ["clone", "--depth=1", cloneUrl, baseDirectory], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  }
  return baseDirectory;
}

export async function createWorktree(baseDirectory: string, worktreePath: string): Promise<void> {
  const parentDirectory = path.dirname(worktreePath);
  await mkdir(parentDirectory, { recursive: true });
  const reference = existsSync(path.join(baseDirectory, ".git", "FETCH_HEAD"))
    ? "FETCH_HEAD"
    : "HEAD";
  await execFileAsync("git", [
    "-C",
    baseDirectory,
    "worktree",
    "add",
    "--detach",
    worktreePath,
    reference,
  ]);
}

export async function removeWorktree(baseDirectory: string, worktreePath: string): Promise<void> {
  await execFileAsync("git", ["-C", baseDirectory, "worktree", "remove", "--force", worktreePath]);
}
