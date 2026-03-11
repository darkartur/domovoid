import { describe, test } from "node:test";
import assert from "node:assert/strict";
import vcrExtractResponse from "./vcr-extract-response.ts";

describe("vcrExtractResponse", () => {
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
