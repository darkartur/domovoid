import { definePlugin } from "@domovoid/plugin-utils";
import { runClaude } from "./subprocess.ts";

export const claudeAgentPlugin = definePlugin(() => {
  return {
    agent: {
      async run({ prompt, workingDirectory }) {
        const result = await runClaude({ prompt, repoCwd: workingDirectory });
        return result.text;
      },
    },
  };
});
