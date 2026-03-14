import { startDaemon } from "./index.js";

const server = await startDaemon();

process.on("SIGTERM", () => {
  server.close();
});
