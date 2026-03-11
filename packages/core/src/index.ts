import path from "node:path";
import { loadConfig } from "./config.ts";
import { startHealthCheckServer } from "./health.ts";
import { DOMOVOID_DIR } from "./constants.ts";
import { createGithubPlugin } from "@domovoid/integration-github";
import { claudeAgentPlugin } from "@domovoid/integration-claude-agent";
import type {
  Task,
  PluginContext,
  VcsCapabilities,
  TasksCapabilities,
  AgentCapabilities,
  AnyEvent,
} from "@domovoid/plugin-utils";

const config = await loadConfig();

const repos = Object.keys(config.projects).map((projectId) => {
  const splitParts = projectId.split("/");
  const owner = splitParts[0] ?? "";
  const name = splitParts[1] ?? "";
  return { owner, name };
});

function throwMissing(capability: string): never {
  throw new Error(`Required plugin capability not provided: ${capability}`);
}

// Object holder lets us wire up the handler after plugin capabilities are created.
// Using an object (not let) avoids the prefer-const lint issue.
const taskHandlerHolder: { onNewTask: ((task: Task) => Promise<void>) | undefined } = {
  onNewTask: undefined,
};

function sendEvent(event: AnyEvent): void {
  taskHandlerHolder.onNewTask?.(event.payload).catch((error: unknown) => {
    console.error("Task handler failed:", error);
  });
}

const githubContext: PluginContext = {
  dataDirectory: path.join(DOMOVOID_DIR, "github"),
  sendEvent,
};

const agentContext: PluginContext = {
  dataDirectory: DOMOVOID_DIR,
  sendEvent,
};

const githubCaps = createGithubPlugin(repos)(githubContext);
const agentCaps = claudeAgentPlugin(agentContext);

const vcs: VcsCapabilities = githubCaps.vcs ?? throwMissing("vcs");
const tasks: TasksCapabilities = githubCaps.tasks ?? throwMissing("tasks");
const agent: AgentCapabilities = agentCaps.agent ?? throwMissing("agent");

function buildPrompt(task: Task): string {
  return [
    `You are a planning assistant. Analyze this GitHub issue and create an implementation plan.`,
    `The repository codebase is available in your current working directory — explore it freely.`,
    ``,
    `Issue: ${task.title}`,
    ``,
    task.description,
    ``,
    `Please provide:`,
    `1. A clear implementation plan with numbered steps`,
    `2. Any clarifying questions if needed`,
    `3. Estimated complexity`,
  ].join("\n");
}

taskHandlerHolder.onNewTask = async (task: Task): Promise<void> => {
  const projectConfig = config.projects[task.projectId];
  if (!projectConfig) {
    console.error(`No config for project: ${task.projectId}`);
    return;
  }

  const parts = task.id.split("/");
  const owner = parts[0];
  const repo = parts[1];
  const issueNumberString = parts[2];
  if (!owner || !repo || !issueNumberString) {
    console.error(`Invalid task id: ${task.id}`);
    return;
  }
  const issueNumber = Number(issueNumberString);

  const worktreePath = path.join(
    DOMOVOID_DIR,
    "github",
    "worktrees",
    owner,
    repo,
    `issue-${String(issueNumber)}`,
  );

  try {
    await vcs.clone(projectConfig.repositoryUrl, worktreePath, {});
    const prompt = buildPrompt(task);
    const result = await agent.run({ prompt, workingDirectory: worktreePath });
    await tasks.postComment(task.id, result);
  } finally {
    await vcs.remove(worktreePath);
  }
};

startHealthCheckServer();
