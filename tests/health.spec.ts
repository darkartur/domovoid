import { expect, test } from "./fixtures.ts";

test.describe("health server", () => {
  test.use({ appEnv: { PORT: "3002", DOMOVOID_NO_RESTART: "1" } });

  test("health endpoint returns ok", async ({ app }) => {
    const response = await fetch(`${app.url}/health`);
    expect(response.ok).toBe(true);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  test("unknown route returns 404", async ({ app }) => {
    const response = await fetch(`${app.url}/unknown`);
    expect(response.status).toBe(404);
  });
});
