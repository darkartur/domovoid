import { tmpdir } from "node:os";
import nodePath from "node:path";

export const PID_FILE = nodePath.join(tmpdir(), "domovoid.pid");
