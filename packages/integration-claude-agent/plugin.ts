import { definePlugin } from "@domovoid/plugin-utils";
import { runWithSDK } from "./sdk.ts";

export const claudeAgentPlugin = definePlugin(() => {
  return {
    agent: {
      async run({ prompt, workingDirectory }) {
        return runWithSDK(prompt, workingDirectory);
      },
    },
  };
});
