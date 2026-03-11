import { describe, test } from "node:test";
import assert from "node:assert/strict";
import vcrExtractResponse from "./vcr-extract-response.ts";

describe("vcrExtractResponse", () => {
  test("replaces issue number in response text with number from request", () => {
    const cacheEntry = {
      request: { messages: [{ role: "user", content: "work in /repos/owner/repo/issue-42" }] },
      response: { content: [{ type: "text", text: "I will work in /repos/owner/repo/issue-42" }] },
    };
    const request = { messages: [{ role: "user", content: "work in /repos/owner/repo/issue-7" }] };

    const result = vcrExtractResponse(cacheEntry, request) as {
      content: { type: string; text: string }[];
    };

    assert.equal(result.content[0]?.text, "I will work in /repos/owner/repo/issue-7");
  });

  test("replaces issue numbers inside nested response objects", () => {
    const cacheEntry = {
      request: {},
      response: {
        content: [{ type: "text", text: "working in /repo/issue-42" }],
      },
    };
    const request = { messages: [{ role: "user", content: "go to issue-7 please" }] };

    const result = vcrExtractResponse(cacheEntry, request) as {
      content: { type: string; text: string }[];
    };

    assert.equal(result.content[0]?.text, "working in /repo/issue-7");
  });

  test("replaces issue number in tool_use input strings", () => {
    const cacheEntry = {
      request: {},
      response: {
        content: [
          {
            type: "tool_use",
            id: "toolu_XXXX",
            name: "Bash",
            input: { command: "cd /repos/owner/repo/issue-42 && npm test" },
          },
        ],
      },
    };
    const request = { messages: [{ role: "user", content: "issue-7" }] };

    const result = vcrExtractResponse(cacheEntry, request) as {
      content: { type: string; id: string; name: string; input: { command: string } }[];
    };

    assert.equal(result.content[0]?.input.command, "cd /repos/owner/repo/issue-7 && npm test");
  });

  test("returns response unchanged when request has no issue number", () => {
    const response = {
      content: [{ type: "text", text: "I will work in /repos/owner/repo/issue-42" }],
    };
    const cacheEntry = { request: {}, response };
    const request = { messages: [{ role: "user", content: "do something" }] };

    const result = vcrExtractResponse(cacheEntry, request);

    assert.deepEqual(result, response);
  });

  test("returns response unchanged when response has no issue number", () => {
    const response = { content: [{ type: "text", text: "Hello, I will help you." }] };
    const cacheEntry = { request: {}, response };
    const request = { messages: [{ role: "user", content: "work in issue-7" }] };

    const result = vcrExtractResponse(cacheEntry, request);

    assert.deepEqual(result, response);
  });

  test("replaying the same run returns the response unchanged", async () => {
    const { default: entry } = await import("./__test__/msg-1a.json", {
      with: { type: "json" },
    });

    const result = vcrExtractResponse(entry, entry.request);

    assert.deepEqual(result, entry.response);
  });

  test("cross-run: initial messages are identiacal", async () => {
    const [{ default: cached }, { default: incoming }] = await Promise.all([
      import("./__test__/msg-1a.json", { with: { type: "json" } }),
      import("./__test__/msg-1ab.json", { with: { type: "json" } }),
    ]);

    const result = vcrExtractResponse(cached, incoming.request);

    assert.deepEqual(result, incoming.response);
  });

  test("cross-run: second messages are identical", async () => {
    const [{ default: cached }, { default: incoming }] = await Promise.all([
      import("./__test__/msg-2a.json", { with: { type: "json" } }),
      import("./__test__/msg-2ab.json", { with: { type: "json" } }),
    ]);

    const result = vcrExtractResponse(cached, incoming.request);

    assert.deepEqual(result, incoming.response);
  });
});
