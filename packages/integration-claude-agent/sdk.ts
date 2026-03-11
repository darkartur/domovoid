import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import Anthropic from "@anthropic-ai/sdk";

type Message = Anthropic.MessageParam;
type Tool = Anthropic.Tool;

function buildClient(): Anthropic {
  const tokenFile = process.env["CLAUDE_SESSION_INGRESS_TOKEN_FILE"];
  if (tokenFile && existsSync(tokenFile)) {
    const token = readFileSync(tokenFile, "utf8").trim();
    if (token) {
      return new Anthropic({
        apiKey: "no-key",
        defaultHeaders: { Authorization: `Bearer ${token}`, "x-api-key": "" },
      });
    }
  }
  const apiKey = process.env["ANTHROPIC_API_KEY"] ?? process.env["CLAUDE_CODE_OAUTH_TOKEN"];
  if (!apiKey) throw new Error("No authentication available for Anthropic API");
  return new Anthropic({ apiKey });
}

const TOOLS: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to working directory" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories at a path",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to working directory (defaults to .)",
        },
      },
      required: [],
    },
  },
  {
    name: "glob",
    description: "Find files matching a glob pattern",
    input_schema: {
      type: "object" as const,
      properties: { pattern: { type: "string", description: "Glob pattern, e.g. '**/*.ts'" } },
      required: ["pattern"],
    },
  },
];

function runTool(name: string, input: Record<string, string>, cwd: string): string {
  try {
    if (name === "read_file") {
      const p = path.resolve(cwd, input["path"] ?? "");
      if (!p.startsWith(cwd)) return "Error: path outside working directory";
      return existsSync(p) ? readFileSync(p, "utf8") : "Error: file not found";
    }
    if (name === "list_directory") {
      const p = path.resolve(cwd, input["path"] ?? ".");
      if (!p.startsWith(cwd)) return "Error: path outside working directory";
      if (!existsSync(p)) return "Error: directory not found";
      return readdirSync(p).join("\n");
    }
    if (name === "glob") {
      const files = globSync(input["pattern"] ?? "*", { cwd, nodir: true });
      return files.join("\n");
    }
    return "Error: unknown tool";
  } catch (error) {
    return `Error: ${String(error)}`;
  }
}

export async function runWithSDK(prompt: string, cwd: string): Promise<string> {
  const client = buildClient();
  const messages: Message[] = [{ role: "user", content: prompt }];

  for (let turn = 0; turn < 10; turn++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: runTool(b.name, b.input as Record<string, string>, cwd),
        }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  throw new Error("Agent did not produce a final response");
}
