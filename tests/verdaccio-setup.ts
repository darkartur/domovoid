import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { runServer } from "verdaccio";

const PORT = 4873;
const STORAGE_PATH = path.join(os.tmpdir(), "domovoid-verdaccio-storage");

export default async function setup() {
  // Clean storage so each test run starts with a fresh registry
  await fs.rm(STORAGE_PATH, { recursive: true, force: true });

  const server = (await runServer({
    configPath: path.join(os.tmpdir(), "verdaccio.yaml"),
    storage: STORAGE_PATH,
    uplinks: {},
    packages: { "**": { access: "$all", publish: "$all" } },
    auth: {
      htpasswd: {
        file: path.join(STORAGE_PATH, ".htpasswd"),
        max_users: 1000,
      },
    },
    log: { type: "stdout", format: "pretty", level: "error" },
  })) as unknown as http.Server;

  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  return () => {
    server.close();
  };
}
