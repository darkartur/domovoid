import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");

export default async function stopCommand(): Promise<void> {
  const content = await readFile(PID_FILE, "utf8");
  const pid = Number.parseInt(content.trim(), 10);
  if (Number.isNaN(pid)) {
    throw new TypeError("Invalid PID in file");
  }

  process.kill(pid);
  await rm(PID_FILE, { force: true });
  process.stdout.write(`Daemon stopped (PID ${String(pid)})\n`);
}
