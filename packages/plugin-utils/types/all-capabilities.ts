import type { AgentCapabilities } from "./agent.ts";
import type { TasksCapabilities } from "./tasks.ts";
import type { VcsCapabilities } from "./vcs.ts";

export interface PluginCapabilities {
  vcs?: VcsCapabilities;
  tasks?: TasksCapabilities;
  agent?: AgentCapabilities;
}
