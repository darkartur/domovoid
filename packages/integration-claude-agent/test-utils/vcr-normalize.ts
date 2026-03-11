import assert from "node:assert";

async function calculateObjectHash(value: object): Promise<string> {
  const stringValue = JSON.stringify(value);
  const messageUint8 = new TextEncoder().encode(stringValue);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageUint8);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeMessages(messages: unknown[]): unknown[] {
  // First pass: collect all toolu_* IDs in document order
  const toolIdMap = new Map<string, string>();
  let toolIdCounter = 0;

  function collectToolIds(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) collectToolIds(item);
    } else if (typeof value === "object" && value !== null) {
      const object = value as Record<string, unknown>;
      if (
        typeof object["id"] === "string" &&
        object["id"].startsWith("toolu_") &&
        !toolIdMap.has(object["id"])
      ) {
        toolIdMap.set(object["id"], `tool_${String(toolIdCounter++)}`);
      }
      if (
        typeof object["tool_use_id"] === "string" &&
        object["tool_use_id"].startsWith("toolu_") &&
        !toolIdMap.has(object["tool_use_id"])
      ) {
        toolIdMap.set(object["tool_use_id"], `tool_${String(toolIdCounter++)}`);
      }
      for (const v of Object.values(object)) collectToolIds(v);
    }
  }

  for (const message of messages) collectToolIds(message);

  // Second pass: replace IDs + normalize paths recursively
  function normalizeValue(value: unknown): unknown {
    if (typeof value === "string") {
      return value.replaceAll(/issue-\d+/g, "issue-N");
    }
    if (Array.isArray(value)) {
      return value.map((item) => normalizeValue(item));
    }
    if (typeof value === "object" && value !== null) {
      const object = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(object)) {
        if (k === "id" && typeof v === "string" && toolIdMap.has(v)) {
          result[k] = toolIdMap.get(v) ?? v;
        } else if (k === "tool_use_id" && typeof v === "string" && toolIdMap.has(v)) {
          result[k] = toolIdMap.get(v) ?? v;
        } else {
          result[k] = normalizeValue(v);
        }
      }
      return result;
    }
    return value;
  }

  return messages.map((message) => {
    if (typeof message !== "object" || message === null) return message;
    const message_ = message as Record<string, unknown>;
    const content = Array.isArray(message_["content"])
      ? message_["content"].filter((block) => {
          if (typeof block !== "object" || block === null) return true;
          const b = block as Record<string, unknown>;
          if (b["type"] === "thinking") return false;
          if (
            b["type"] === "text" &&
            typeof b["text"] === "string" &&
            b["text"].startsWith("<system-reminder>")
          )
            return false;
          return true;
        })
      : message_["content"];
    return normalizeValue({ ...message_, content });
  });
}

function normalizeRequestBody(requestBody: unknown): object {
  assert.ok(typeof requestBody === "object" && requestBody !== null, "Body must be an object");
  const { model, messages, tools, thinking, output_config } = requestBody as Record<
    string,
    unknown
  >;
  // Excluded: max_tokens, system, stream (volatile per-session fields), metadata (contains session ID)
  return {
    model,
    thinking,
    output_config,
    tools,
    messages: normalizeMessages(Array.isArray(messages) ? messages : []),
  };
}

export async function calculateCacheKey(requestBody: unknown): Promise<string> {
  if (typeof requestBody !== "object" || requestBody === null) {
    throw new Error("Body must be an object");
  }
  return calculateObjectHash(normalizeRequestBody(requestBody));
}
