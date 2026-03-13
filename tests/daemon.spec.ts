import { test, expect } from "./fixtures/base.ts";
import { DEFAULT_PORT } from "../packages/runtime/src/index.ts";

const TEST_PORT = 17_777;

function waitForHealth(port: number, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const check = (): void => {
      fetch(`http://127.0.0.1:${String(port)}/health`)
        .then((response) => {
          if (response.ok) {
            resolve(true);
          } else if (Date.now() < deadline) {
            setTimeout(check, 100);
          } else {
            resolve(false);
          }
        })
        .catch(() => {
          if (Date.now() < deadline) {
            setTimeout(check, 100);
          } else {
            resolve(false);
          }
        });
    };

    check();
  });
}

test("DEFAULT_PORT is exported from runtime", () => {
  expect(DEFAULT_PORT).toBe(7777);
});

test("start launches daemon and health endpoint returns ok", async ({ cli }) => {
  try {
    const startResult = await cli(["start"], { DOMOVOID_PORT: String(TEST_PORT) });
    expect(startResult.exitCode).toBe(0);
    expect(startResult.stdout).toContain("Daemon started");

    const healthy = await waitForHealth(TEST_PORT);
    expect(healthy).toBe(true);

    const response = await fetch(`http://127.0.0.1:${String(TEST_PORT)}/health`);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  } finally {
    await cli(["stop"]);
  }
});

test("stop terminates the daemon", async ({ cli }) => {
  await cli(["start"], { DOMOVOID_PORT: String(TEST_PORT) });
  await waitForHealth(TEST_PORT);

  const stopResult = await cli(["stop"]);
  expect(stopResult.exitCode).toBe(0);
  expect(stopResult.stdout).toContain("Daemon stopped");

  const stillUp = await waitForHealth(TEST_PORT, 2000);
  expect(stillUp).toBe(false);
});
