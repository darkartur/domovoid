import { createServer } from "node:http";
import v8 from "node:v8";

export function startHealthCheckServer(port = 3000): void {
  const server = createServer((request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
    } else {
      response.writeHead(404);
      response.end();
    }
  });

  server.listen(port, () => {
    console.log(`Health check server listening on port ${String(port)}`);
  });

  process.on("SIGTERM", () => {
    v8.takeCoverage();
    server.close();
  });
}
