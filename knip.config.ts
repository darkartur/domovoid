import type { KnipConfig } from "knip";

export default {
  // "report" is a subcommand of the c8 CLI (c8 report …), not a standalone
  // binary. Knip's script parser doesn't distinguish subcommands from binaries,
  // so we suppress this false positive here.
  ignoreBinaries: ["report"],
  ignoreDependencies: ["@domovoid/cli"],
  workspaces: {
    ".": {
      project: ["*.{js,ts}", "tests/**/*.ts", "scripts/**/*.ts"],
    },
    "packages/*": {
      project: ["**/*.ts"],
    },
  },
} satisfies KnipConfig;
