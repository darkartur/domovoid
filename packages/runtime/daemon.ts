import { startDaemon } from "./src/index.ts";

const port =
  process.env["DOMOVOID_PORT"] === undefined ? undefined : Number(process.env["DOMOVOID_PORT"]);

await startDaemon(port);
