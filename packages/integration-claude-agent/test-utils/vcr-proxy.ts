import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env["PORT"]) || 8082;
const CACHE_DIR = process.env["CACHE_DIR"] ?? path.join(process.cwd(), ".cache");
const REPLAY_ONLY = process.env["REPLAY_ONLY"] === "true";

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function calculateCacheKey(requestBody: unknown): Promise<string> {
  if (typeof requestBody !== "object" || requestBody === null) {
    throw new Error("Body must be an object");
  }

  const sortedBody = JSON.stringify(requestBody, Object.keys(requestBody).toSorted());
  const messageUint8 = new TextEncoder().encode(sortedBody);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageUint8);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const buffers = [];
  for await (const chunk of request) buffers.push(chunk);
  return JSON.parse(Buffer.concat(buffers).toString());
}

function convertHeaders(headers: IncomingMessage["headers"]): [string, string][] {
  const result: [string, string][] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const valueItem of value) {
        result.push([key, valueItem]);
      }
    } else if (typeof value === "string") {
      result.push([key, value]);
    }
  }

  return result;
}

interface CacheRecord {
  request: unknown;
  response: unknown;
}

async function handleRequest(
  originalRequest: IncomingMessage,
  originalResponse: ServerResponse,
): Promise<void> {
  console.log(`[REQUEST] ${originalRequest.method ?? ""} ${originalRequest.url ?? ""}`);

  if (originalRequest.method === "GET" && originalRequest.url === "/health") {
    originalResponse.writeHead(200).end("ok");
    return;
  }

  // Only handle Anthropic message endpoint
  if (originalRequest.url?.startsWith("/v1/messages") && originalRequest.method === "POST") {
    try {
      const requestBody = await readJson(originalRequest);

      const hash = await calculateCacheKey(requestBody);
      const cachePath = path.join(CACHE_DIR, `${hash}.json`);

      if (existsSync(cachePath)) {
        console.log(`[HIT] ${hash.slice(0, 8)}`);
        const cached = JSON.parse(await readFile(cachePath, "utf8")) as CacheRecord;
        originalResponse.writeHead(200, { "Content-Type": "application/json" });
        originalResponse.end(JSON.stringify(cached.response));
        return;
      }

      if (REPLAY_ONLY) {
        console.warn(`[MISS] Replay only mode: ${hash.slice(0, 8)}`);
        originalResponse.writeHead(404);
        originalResponse.end(JSON.stringify({ error: "Cache miss in REPLAY_ONLY" }));
        return;
      }

      // C. Forward to Anthropic using Native Fetch
      console.log(`[MISS] Fetching from Anthropic...`);
      const STRIP_HEADERS = new Set([
        "accept",
        "content-length",
        "host",
        "connection",
        "transfer-encoding",
      ]);
      const forwardHeaders = Object.fromEntries(
        Object.entries(originalRequest.headers).filter(([key]) => !STRIP_HEADERS.has(key)),
      ) as IncomingMessage["headers"];
      const forwardBody =
        typeof requestBody === "object" && requestBody !== null
          ? { ...(requestBody as Record<string, unknown>), stream: false }
          : requestBody;
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: convertHeaders({
          ...forwardHeaders,
          "content-type": "application/json",
        }),
        body: JSON.stringify(forwardBody),
      });

      if (!anthropicResponse.ok) {
        throw new Error(
          `Anthropic API returned ${anthropicResponse.status.toString()} ${anthropicResponse.statusText}`,
        );
      }

      const data = await anthropicResponse.json();

      await writeFile(
        cachePath,
        JSON.stringify(
          {
            request: requestBody,
            response: data,
          },
          undefined,
          2,
        ),
      );

      originalResponse.writeHead(anthropicResponse.status, { "Content-Type": "application/json" });
      originalResponse.end(JSON.stringify(data));
    } catch (error: unknown) {
      console.error(error);
      originalResponse.writeHead(500);
      originalResponse.end(
        JSON.stringify({
          error: "Proxy Error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  } else {
    originalResponse.writeHead(404).end();
  }
}

// 2. The Server Logic
const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  handleRequest(request, response).catch((error: unknown) => {
    console.error(error);
    response.writeHead(500);
    response.end(
      JSON.stringify({
        error: "Internal Proxy Server Error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

server.listen(PORT, () => {
  console.log(`✨ Claude vcr proxy online at http://localhost:${PORT.toString()}`);
});
