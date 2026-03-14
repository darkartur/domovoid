import { startDaemon } from "./src/index.ts";

const port =
  process.env["DOMOVOID_PORT"] === undefined ? undefined : Number(process.env["DOMOVOID_PORT"]);

const server = await startDaemon(port);

process.on("SIGTERM", () => {
  server.close();
});
