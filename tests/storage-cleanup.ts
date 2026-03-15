import fs from "node:fs/promises";

const STORAGE_PATH = "/tmp/domovoid-verdaccio-storage";

export default async function setup() {
  await fs.rm(STORAGE_PATH, { recursive: true, force: true });
}
