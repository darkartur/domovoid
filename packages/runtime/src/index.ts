import { createServer } from "node:http";
import type { Server } from "node:http";

export const VERSION = "0.1.0";
export const DEFAULT_PORT = 7777;

export function startDaemon(port?: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
    });
    server.on("error", reject);
    server.listen(port ?? DEFAULT_PORT, () => {
      resolve(server);
    });
  });
}
