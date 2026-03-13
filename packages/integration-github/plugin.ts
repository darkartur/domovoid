import { definePlugin } from "@domovoid/plugin-utils";
import type { PluginDefinition } from "@domovoid/plugin-utils";
import { createOctokitClient } from "./client.ts";
import { GitHubPoller } from "./poller.ts";
import { ensureBaseClone, createWorktree, removeWorktree } from "./repo.ts";

export interface RepoConfig {
  owner: string;
  name: string;
}

export function createGithubPlugin(repos: RepoConfig[]): PluginDefinition {
  return definePlugin((context) => {
    const octokit = createOctokitClient();
    const worktreeMap = new Map<string, string>();

    const pollers = repos.map(
      (repo) => new GitHubPoller(octokit, context, repo.owner, repo.name, 30_000),
    );
    for (const poller of pollers) {
      poller.start();
    }
    process.on("SIGTERM", () => {
      for (const poller of pollers) {
        poller.stop();
      }
    });

    return {
      tasks: {
        getProjects() {
          return Promise.resolve(
            repos.map((repo) => ({
              id: `${repo.owner}/${repo.name}`,
              name: `${repo.owner}/${repo.name}`,
            })),
          );
        },

        getActiveTasks() {
          return Promise.resolve([]);
        },

        async postComment(taskId, result) {
          const parts = taskId.split("/");
          const owner = parts[0];
          const repo = parts[1];
          const issueNumberString = parts[2];
          if (!owner || !repo || !issueNumberString) {
            throw new Error(`Invalid task id: ${taskId}`);
          }
          const issueNumber = Number(issueNumberString);
          await octokit.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: result,
          });
        },
      },

      vcs: {
        async clone(repositoryUrl, directoryPath) {
          const { token } = (await octokit.auth({ type: "installation" })) as { token: string };
          const baseDirectory = await ensureBaseClone(repositoryUrl, context.dataDirectory, token);
          await createWorktree(baseDirectory, directoryPath);
          worktreeMap.set(directoryPath, baseDirectory);
        },

        async remove(directoryPath) {
          const baseDirectory = worktreeMap.get(directoryPath);
          if (!baseDirectory) {
            throw new Error(`No base directory tracked for worktree: ${directoryPath}`);
          }
          await removeWorktree(baseDirectory, directoryPath);
          worktreeMap.delete(directoryPath);
        },
      },
    };
  });
}
