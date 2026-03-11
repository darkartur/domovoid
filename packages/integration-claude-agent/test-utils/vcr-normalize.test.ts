import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessages, calculateCacheKey } from "./vcr-normalize.ts";

// ---------------------------------------------------------------------------
// normalizeMessages — unit tests on synthetic data
// ---------------------------------------------------------------------------

describe("normalizeMessages", () => {
  test("strips thinking blocks from assistant content", () => {
    const result = normalizeMessages([
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "let me think", signature: "sig_abc" },
          { type: "text", text: "Hello" },
        ],
      },
    ]);
    assert.deepEqual(result, [{ role: "assistant", content: [{ type: "text", text: "Hello" }] }]);
  });

  test("normalizes toolu_ IDs to sequential tool_0, tool_1, …", () => {
    const result = normalizeMessages([
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_AAAA", name: "Bash", input: { command: "ls" } }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_AAAA", content: "ok" }],
      },
    ]);
    assert.deepEqual(result, [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "tool_0", name: "Bash", input: { command: "ls" } }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tool_0", content: "ok" }],
      },
    ]);
  });

  test("assigns sequential IDs to multiple distinct tool calls", () => {
    const result = normalizeMessages([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_AAAA", name: "Bash", input: {} },
          { type: "tool_use", id: "toolu_BBBB", name: "Read", input: {} },
        ],
      },
    ]);
    const content = (result[0] as Record<string, unknown>)["content"] as Record<string, unknown>[];
    assert.equal(content[0]?.["id"], "tool_0");
    assert.equal(content[1]?.["id"], "tool_1");
  });

  test("replaces issue-N paths in string values", () => {
    const result = normalizeMessages([
      {
        role: "user",
        content: "work in /worktrees/owner/repo/issue-42 and fix it",
      },
    ]);
    assert.deepEqual(result, [
      {
        role: "user",
        content: "work in /worktrees/owner/repo/issue-N and fix it",
      },
    ]);
  });

  test("replaces issue-N inside nested tool input strings", () => {
    const result = normalizeMessages([
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_AAAA",
            name: "Bash",
            input: { command: "cd /repos/owner/repo/issue-7 && npm test" },
          },
        ],
      },
    ]);
    const blocks = (result[0] as Record<string, unknown>)["content"] as Record<string, unknown>[];
    assert.ok(blocks[0]);
    assert.deepEqual(blocks[0]["input"], { command: "cd /repos/owner/repo/issue-N && npm test" });
  });
});

// ---------------------------------------------------------------------------
// calculateCacheKey — cross-run hash stability with real fixtures
//
// Fixtures are full cache entries { request, response } — two runs of the
// same logical conversation turn, differing only in volatile fields:
//   • issue number in paths  (issue-42 vs issue-7)
//   • toolu_* IDs            (different per session)
//   • max_tokens             (set by Claude Code dynamically)
//   • system[0]              (per-session billing hash)
//   • stream                 (sometimes absent, sometimes false)
//
// After normalization all pairs must hash identically.
// ---------------------------------------------------------------------------

describe("calculateCacheKey — real fixture pairs (cache-examples, pre-fix runs)", () => {
  test("msg-1a and msg-1b should produce the same hash", async () => {
    const [{ default: r1 }, { default: r2 }] = await Promise.all([
      import("./__test__/msg-1a.json", { with: { type: "json" } }),
      import("./__test__/msg-1b.json", { with: { type: "json" } }),
    ]);
    assert.equal(await calculateCacheKey(r1.request), await calculateCacheKey(r2.request));
  });

  test("msg-1a and msg-1c should produce the same hash", async () => {
    const [{ default: r1 }, { default: r2 }] = await Promise.all([
      import("./__test__/msg-1a.json", { with: { type: "json" } }),
      import("./__test__/msg-1c.json", { with: { type: "json" } }),
    ]);
    assert.equal(await calculateCacheKey(r1.request), await calculateCacheKey(r2.request));
  });

  test("msg-2a and msg-2b should produce the same hash", async () => {
    const [{ default: r1 }, { default: r2 }] = await Promise.all([
      import("./__test__/msg-2a.json", { with: { type: "json" } }),
      import("./__test__/msg-2b.json", { with: { type: "json" } }),
    ]);
    assert.equal(await calculateCacheKey(r1.request), await calculateCacheKey(r2.request));
  });

  test("msg-3a and msg-3b should produce the same hash", async () => {
    const [{ default: r1 }, { default: r2 }] = await Promise.all([
      import("./__test__/msg-3a.json", { with: { type: "json" } }),
      import("./__test__/msg-3b.json", { with: { type: "json" } }),
    ]);
    assert.equal(await calculateCacheKey(r1.request), await calculateCacheKey(r2.request));
  });
});
