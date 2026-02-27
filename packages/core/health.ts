import { createServer } from "node:http";
import v8 from "node:v8";
import { checkForUpdate } from "./autoupdate.ts";

export function startHealthCheckServer(currentVersion: string, port = 3000): void {
  const server = createServer((request, response) => {
    const requestUrl = request.url;
    if (requestUrl === "/health" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
    } else if (requestUrl?.startsWith("/check-update") && request.method === "GET") {
      const urlObject = new URL(requestUrl, "http://x");
      const registryUrl = urlObject.searchParams.get("registryUrl");
      if (registryUrl === null) {
        response.writeHead(400);
        response.end();
        return;
      }
      void checkForUpdate(currentVersion, registryUrl)
        .then((result) => {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify(result));
        })
        .catch(() => {
          response.writeHead(500);
          response.end();
        });
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
