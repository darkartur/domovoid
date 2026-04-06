import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { DOMOVOID_DIR } from "./constants.ts";

const ProjectConfigSchema = z.object({
  repositoryUrl: z.string(),
});

export const DomovoidConfigSchema = z.object({
  projects: z.record(z.string(), ProjectConfigSchema),
});

type DomovoidConfig = z.infer<typeof DomovoidConfigSchema>;

const CONFIG_PATH =
  process.env["DOMOVOID_CONFIG"] ?? path.resolve(DOMOVOID_DIR, "./domovoid-config.yml");

export async function loadConfig(): Promise<DomovoidConfig> {
  const content = await readFile(CONFIG_PATH, "utf8");
  return DomovoidConfigSchema.parse(parse(content));
}
