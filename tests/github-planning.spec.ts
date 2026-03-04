import { test, expect } from "@playwright/test";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const OWNER = "darkartur";
const REPO = "domovoid-test";

const DOMOVOID_DIR = path.resolve(process.env["DOMOVOID_DIR"] ?? path.join(homedir(), ".domovoid"));
const BASE_CLONE_DIR = path.join(DOMOVOID_DIR, "github", OWNER, REPO);
const WORKTREES_DIR = path.join(DOMOVOID_DIR, "github", "worktrees", OWNER, REPO);

let octokit: Octokit;
let issueNumber: number;

test.beforeAll(() => {
  octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env["GITHUB_APP_ID"],
      privateKey: process.env["GITHUB_APP_PRIVATE_KEY"],
      installationId: Number(process.env["GITHUB_APP_INSTALLATION_ID"]),
    },
  });
});

test.afterEach(async () => {
  await octokit.issues.update({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    state: "closed",
  });
});

test("bot posts a plan as a comment when issue is labeled 'todo'", async () => {
  // Create a test issue describing a real task in the repository
  const { data: issue } = await octokit.issues.create({
    owner: OWNER,
    repo: REPO,
    title: `test: planning flow`,
    body: "Replace unnumbered list in the README with a numbered list where coding languages are sorted by popularity.",
  });
  issueNumber = issue.number;

  // Trigger the planning workflow by adding the label
  await octokit.issues.addLabels({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: ["todo"],
  });

  // Wait for the bot to poll GitHub, call Claude, and post a comment
  await expect
    .poll(
      async () => {
        const { data: comments } = await octokit.issues.listComments({
          owner: OWNER,
          repo: REPO,
          issue_number: issueNumber,
        });
        return comments.length;
      },
      { timeout: 90_000, intervals: [5000] },
    )
    .toBeGreaterThan(0);

  const { data: comments } = await octokit.issues.listComments({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
  });
  const plan = comments[0]?.body ?? "";

  // Plan must be a real response, not an empty string
  expect(plan).toBeTruthy();

  // Plan must contain numbered implementation steps (not a generic stub)
  expect(plan).toMatch(/^\d+\./m);

  // Read the actual README from the cloned base repo — it should exist because
  // the agent cloned it while preparing Claude's working directory.
  const readmePath = path.join(BASE_CLONE_DIR, "README.md");
  expect(existsSync(readmePath)).toBe(true);
  const readmeContent = await readFile(readmePath, "utf8");

  // Extract list items from the README (lines starting with - or *)
  const listItems = readmeContent
    .split("\n")
    .filter((line) => /^[-*]\s+\S/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim());

  // The README must actually contain a list for this test to be meaningful
  expect(listItems.length).toBeGreaterThan(0);

  // Claude explored the codebase — the plan must reference at least one item
  // found in the actual README list (not a hallucinated generic answer)
  expect(listItems.some((item) => plan.includes(item))).toBe(true);

  // Worktree must be removed after planning (no file modifications left behind)
  const worktreePath = path.join(WORKTREES_DIR, `issue-${String(issueNumber)}`);
  expect(existsSync(worktreePath)).toBe(false);
});
