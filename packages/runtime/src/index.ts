import { createServer } from "node:http";
import type { Server } from "node:http";

const PORT = 7777;

const server = await new Promise<Server>((resolve, reject) => {
  const s = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });
  s.on("error", reject);
  s.listen(PORT, () => {
    resolve(s);
  });
});

process.on("SIGTERM", () => {
  server.closeAllConnections();
  server.close();
});
