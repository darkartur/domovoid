import { writeFile } from "node:fs/promises";
import { DomovoidConfigSchema } from "../src/config.ts";
import path from "node:path";

DomovoidConfigSchema.toJSONSchema();

const DIST_PATH = path.resolve(import.meta.dirname, "../dist");
const SCHEMA_PATH = path.join(DIST_PATH, "generated-config-schema.json");

await writeFile(SCHEMA_PATH, JSON.stringify(DomovoidConfigSchema.toJSONSchema(), undefined, 2));
