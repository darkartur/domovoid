import type { PluginCapabilities } from "./all-capabilities.ts";
import type { PluginContext } from "./context.ts";

export type PluginDefinition = (context: PluginContext) => PluginCapabilities;
