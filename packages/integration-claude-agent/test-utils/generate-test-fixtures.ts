/**
 * One-time script: groups all cache entries from cache-examples/ and .cache/
 * by their fixed-normalized hash, then writes them as run{N}-{M}msg.json
 * full cache entries into test-utils/__test__/.
 *
 * Run with: node packages/integration-claude-agent/test-utils/generate-test-fixtures.ts
 */
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { calculateCacheKey } from "./vcr-normalize.ts";

// Script lives in packages/integration-claude-agent/test-utils/
// One level up (..) = packages/integration-claude-agent/
const PACKAGE_DIR = new URL("..", import.meta.url).pathname;
const CACHE_EXAMPLES_DIR = path.join(PACKAGE_DIR, "cache-examples");
const CACHE_DIR = path.join(PACKAGE_DIR, ".cache");
const TEST_DIR = path.join(PACKAGE_DIR, "test-utils/__test__");

interface CacheEntry {
  request: unknown;
  response: unknown;
}

async function readEntries(dir: string): Promise<{ file: string; entry: CacheEntry }[]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const results: { file: string; entry: CacheEntry }[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    results.push({ file, entry: JSON.parse(raw) as CacheEntry });
  }
  return results;
}

// Group entries by normalized hash (same hash = same logical turn)
const cacheExamples = await readEntries(CACHE_EXAMPLES_DIR);
const cacheEntries = await readEntries(CACHE_DIR);

console.log(
  `Loaded ${cacheExamples.length.toString()} from cache-examples, ${cacheEntries.length.toString()} from .cache`,
);

interface GroupedEntry {
  source: "cache-examples" | ".cache";
  file: string;
  entry: CacheEntry;
}

const groups = new Map<string, GroupedEntry[]>();

async function addToGroup(
  items: { file: string; entry: CacheEntry }[],
  source: "cache-examples" | ".cache",
): Promise<void> {
  for (const { file, entry } of items) {
    const hash = await calculateCacheKey(entry.request);
    const existing = groups.get(hash) ?? [];
    existing.push({ source, file, entry });
    groups.set(hash, existing);
  }
}

await addToGroup(cacheExamples, "cache-examples");
await addToGroup(cacheEntries, ".cache");

console.log(`Found ${groups.size.toString()} distinct logical turns (by normalized hash)\n`);

// Determine message count per group and letter suffixes
const messageCountGroups = new Map<number, string[]>(); // msgCount → [hash, ...]
for (const [hash, items] of groups) {
  const request = items[0]?.entry.request as Record<string, unknown>;
  const messageCount = Array.isArray(request["messages"]) ? request["messages"].length : 0;
  const existing = messageCountGroups.get(messageCount) ?? [];
  existing.push(hash);
  messageCountGroups.set(messageCount, existing);
}

// Build a map: hash → base name (e.g. "3msg" or "3msg-a")
const hashToBaseName = new Map<string, string>();
for (const [messageCount, hashes] of messageCountGroups) {
  if (hashes.length === 1) {
    hashToBaseName.set(hashes[0]!, `${messageCount.toString()}msg`);
  } else {
    for (const [index, hash] of hashes.entries()) {
      const letter = String.fromCodePoint(97 + index); // a, b, c...
      hashToBaseName.set(hash, `${messageCount.toString()}msg-${letter}`);
    }
  }
}

// Delete old request-only run*.json files
const existingRunFiles = (await readdir(TEST_DIR)).filter(
  (f) => f.startsWith("run") && f.endsWith(".json"),
);
for (const file of existingRunFiles) {
  await unlink(path.join(TEST_DIR, file));
  console.log(`Deleted old fixture: ${file}`);
}

// Write new full-entry fixtures
console.log("\nWriting new fixtures:");
const created: string[] = [];

for (const [hash, items] of groups) {
  const baseName = hashToBaseName.get(hash) ?? hash.slice(0, 8);

  // Sort: cache-examples first (run1, run2), then .cache (run3+)
  const sorted = [
    ...items.filter((index) => index.source === "cache-examples"),
    ...items.filter((index) => index.source === ".cache"),
  ];

  for (const [index, element] of sorted.entries()) {
    const runNumber = index + 1;
    const name = `run${runNumber.toString()}-${baseName}.json`;
    const outPath = path.join(TEST_DIR, name);
    await writeFile(outPath, JSON.stringify(element?.entry, undefined, 2));
    console.log(`  ${name}  (from ${element?.source}/${element?.file})`);
    created.push(name);
  }
}

console.log(`\nSummary: ${created.length.toString()} fixtures written to __test__/`);
console.log("\nGroups with only 1 run (no cross-run test possible):");
for (const [hash, items] of groups) {
  if (items.length === 1) {
    const baseName = hashToBaseName.get(hash) ?? hash.slice(0, 8);
    console.log(`  ${baseName}  (source: ${items[0]?.source}/${items[0]?.file})`);
  }
}
console.log("\nDone.");
