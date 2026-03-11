import type { Octokit } from "@octokit/rest";
import type { PluginContext } from "@domovoid/plugin-utils";

export class GitHubPoller {
  readonly #octokit: Octokit;
  readonly #context: PluginContext;
  readonly #owner: string;
  readonly #repo: string;
  readonly #intervalMs: number;

  readonly #seenTodoIssueIds = new Set<number>();
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    octokit: Octokit,
    context: PluginContext,
    owner: string,
    repo: string,
    intervalMs: number,
  ) {
    this.#octokit = octokit;
    this.#context = context;
    this.#owner = owner;
    this.#repo = repo;
    this.#intervalMs = intervalMs;
  }

  start(): void {
    void this.#poll();
    this.#timer = setInterval(() => {
      void this.#poll();
    }, this.#intervalMs);
  }

  stop(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  async #poll(): Promise<void> {
    try {
      await this.#pollTodoIssues();
    } catch (error: unknown) {
      console.error("GitHub poll failed", error);
    }
  }

  async #pollTodoIssues(): Promise<void> {
    const { data: issues } = await this.#octokit.issues.listForRepo({
      owner: this.#owner,
      repo: this.#repo,
      labels: "todo",
      state: "open",
      per_page: 50,
    });

    for (const issue of issues) {
      if (!this.#seenTodoIssueIds.has(issue.number)) {
        this.#seenTodoIssueIds.add(issue.number);
        this.#context.sendEvent({
          name: "tasks.newTask",
          payload: {
            id: `${this.#owner}/${this.#repo}/${String(issue.number)}`,
            title: issue.title,
            description: issue.body ?? "",
            projectId: `${this.#owner}/${this.#repo}`,
          },
        });
      }
    }
  }
}
