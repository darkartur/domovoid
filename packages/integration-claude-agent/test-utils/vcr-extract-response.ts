import type { VcrCacheEntry } from "./vcr-types.ts";

function extractIssueNumber(value: unknown): string | undefined {
  if (typeof value === "string") {
    return /issue-(\d+)/.exec(value)?.[1];
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractIssueNumber(item);
      if (result !== undefined) return result;
    }
    return undefined;
  }
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const result = extractIssueNumber(v);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function replaceIssueNumbers(value: unknown, issueNumber: string): unknown {
  if (typeof value === "string") {
    return value.replaceAll(/issue-\d+/g, `issue-${issueNumber}`);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceIssueNumbers(item, issueNumber));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = replaceIssueNumbers(v, issueNumber);
    }
    return result;
  }
  return value;
}

export default function vcrExtractResponse(cacheEntry: VcrCacheEntry, request: unknown): unknown {
  const issueNumber = extractIssueNumber(request);
  if (issueNumber === undefined) return cacheEntry.response;
  return replaceIssueNumbers(cacheEntry.response, issueNumber);
}
