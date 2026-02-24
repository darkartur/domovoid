import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {
      project: ["*.{js,ts}"],
    },
    "packages/*": {
      project: ["**/*.ts"],
    },
  },
} satisfies KnipConfig;
