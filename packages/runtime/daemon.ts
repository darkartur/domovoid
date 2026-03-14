import { startDaemon } from "./src/index.ts";

const server = await startDaemon();

process.on("SIGTERM", () => {
  server.close();
});
