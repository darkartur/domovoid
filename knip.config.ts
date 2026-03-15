import type { KnipConfig } from "knip";

export default {
  // "report" is a subcommand of the c8 CLI (c8 report …), not a standalone
  // binary. Knip's script parser doesn't distinguish subcommands from binaries,
  // so we suppress this false positive here.
  ignoreBinaries: ["report"],
  workspaces: {
    ".": {
      project: ["*.{js,ts}"],
    },
    "packages/cli": {
      project: ["**/*.ts"],
    },
    "packages/runtime": {
      project: ["**/*.ts"],
    },
  },
} satisfies KnipConfig;
