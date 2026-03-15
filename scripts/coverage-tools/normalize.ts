import { readdir, readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface V8CoverageEntry {
  url: string;
  functions: unknown[];
}

interface V8CoverageFile {
  result: V8CoverageEntry[];
}

const COVERAGE_TEMP_DIR = nodePath.resolve("tests/coverage/tmp");
const SANDBOX_SCOPE_ROOT = nodePath.resolve("test-sandbox/node_modules/@domovoid");
const PACKAGES_ROOT = nodePath.resolve("packages");

function rewritePath(filePath: string): string | undefined {
  const absolutePath = nodePath.isAbsolute(filePath)
    ? nodePath.normalize(filePath)
    : nodePath.resolve(filePath);

  if (!absolutePath.startsWith(`${SANDBOX_SCOPE_ROOT}${nodePath.sep}`)) {
    return undefined;
  }

  const relativePath = nodePath.relative(SANDBOX_SCOPE_ROOT, absolutePath);
  return nodePath.join(PACKAGES_ROOT, relativePath);
}

function rewriteUrl(url: string): string {
  if (url.startsWith("file://")) {
    const filePath = fileURLToPath(url);
    const rewritten = rewritePath(filePath);
    return rewritten ? pathToFileURL(rewritten).href : url;
  }

  if (url.startsWith("node:") || url.startsWith("internal:")) {
    return url;
  }

  const rewritten = rewritePath(url);
  return rewritten ?? url;
}

async function normalizeCoverageFile(filePath: string): Promise<boolean> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as V8CoverageFile | V8CoverageEntry[];
  const result = Array.isArray(parsed) ? parsed : parsed.result;
  let changed = false;

  for (const entry of result) {
    const rewritten = rewriteUrl(entry.url);
    if (rewritten !== entry.url) {
      entry.url = rewritten;
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  const next = Array.isArray(parsed) ? result : { ...parsed, result };
  await writeFile(filePath, JSON.stringify(next));
  return true;
}

async function main(): Promise<void> {
  try {
    const entries = await readdir(COVERAGE_TEMP_DIR, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => nodePath.join(COVERAGE_TEMP_DIR, entry.name));

    await Promise.all(jsonFiles.map((file) => normalizeCoverageFile(file)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

await main();
