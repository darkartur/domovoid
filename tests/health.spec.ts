import { test, expect } from "@playwright/test";

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("unknown route returns 404", async ({ request }) => {
  const response = await request.get("/unknown");
  expect(response.status()).toBe(404);
});
