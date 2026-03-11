import { describe, test } from "node:test";
import assert from "node:assert/strict";
import calculateObjectHash from "./calculate-object-hash.ts";

describe("calculateObjectHash", () => {
  test("returns the same hash for equal objects", async () => {
    assert.equal(
      await calculateObjectHash({ a: 1, b: 2, c: 3 }),
      await calculateObjectHash({ a: 1, b: 2, c: 3 }),
    );
  });
});
