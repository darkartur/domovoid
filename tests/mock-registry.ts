import { createServer } from "node:http";

const server = createServer((request, response) => {
  const url = request.url ?? "";
  if (url === "/health") {
    response.writeHead(200);
    response.end();
  } else if (url.startsWith("/no-update/") && url.endsWith("/latest")) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ version: "0.1.0" }));
  } else if (url.startsWith("/with-update/") && url.endsWith("/latest")) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ version: "0.2.0" }));
  } else {
    response.writeHead(503);
    response.end();
  }
});

server.listen(3001, () => {
  console.log("Mock npm registry listening on port 3001");
});

process.on("SIGTERM", () => {
  server.close();
});
