import { test, expect } from "@playwright/test";

const MOCK_REGISTRY = "http://localhost:3001";

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("unknown route returns 404", async ({ request }) => {
  const response = await request.get("/unknown");
  expect(response.status()).toBe(404);
});

test("check-update: no update when version matches", async ({ request }) => {
  const response = await request.get("/check-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/no-update` },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    updateAvailable: false,
    latest: "0.1.0",
    current: "0.1.0",
  });
});

test("check-update: update available when newer version exists", async ({ request }) => {
  const response = await request.get("/check-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/with-update` },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    updateAvailable: true,
    latest: "0.2.0",
    current: "0.1.0",
  });
});

test("check-update: returns 500 when registry is unavailable", async ({ request }) => {
  const response = await request.get("/check-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/error` },
  });
  expect(response.status()).toBe(500);
});

test("check-update: returns 400 when registryUrl param is missing", async ({ request }) => {
  const response = await request.get("/check-update");
  expect(response.status()).toBe(400);
});

test("trigger-update: returns 400 when registryUrl param is missing", async ({ request }) => {
  const response = await request.post("/trigger-update");
  expect(response.status()).toBe(400);
});

test("trigger-update: no update when version matches", async ({ request }) => {
  const response = await request.post("/trigger-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/no-update` },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    updateAvailable: false,
    latest: "0.1.0",
    current: "0.1.0",
  });
});

test("trigger-update: installs update when newer version exists", async ({ request }) => {
  const response = await request.post("/trigger-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/with-update` },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    updateAvailable: true,
    latest: "0.2.0",
    current: "0.1.0",
  });
});

test("trigger-update: returns 500 when registry is unavailable", async ({ request }) => {
  const response = await request.post("/trigger-update", {
    params: { registryUrl: `${MOCK_REGISTRY}/error` },
  });
  expect(response.status()).toBe(500);
});
