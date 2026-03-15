import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DAEMON_ENTRY = fileURLToPath(import.meta.resolve("@domovoid/runtime"));
const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");

export default async function startCommand(): Promise<void> {
  const child = spawn("node", [DAEMON_ENTRY], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  const { pid } = child;
  /* c8 ignore next 3 -- spawn("node", …) always assigns a pid; undefined only when OS refuses to create the process */
  if (pid === undefined) {
    throw new Error("Failed to start daemon: could not get PID");
  }

  await writeFile(PID_FILE, String(pid));
  process.stdout.write(`Daemon started (PID ${String(pid)})\n`);
}
