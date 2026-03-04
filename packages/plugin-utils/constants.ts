import { homedir } from "node:os";
import path from "node:path";

export const DOMOVOID_DIR = path.resolve(
  process.env["DOMOVOID_DIR"] ?? path.join(homedir(), ".domovoid"),
);
