import { definePlugin } from "@domovoid/plugin-utils";
import { runClaude } from "./subprocess.ts";

export const claudeAgentPlugin = definePlugin(() => {
  const token = process.env["CLAUDE_CODE_OAUTH_TOKEN"];

  return {
    agent: {
      async run({ prompt, workingDirectory }) {
        const options = { prompt, repoCwd: workingDirectory };
        if (token !== undefined) {
          const result = await runClaude({ ...options, token });
          return result.text;
        }
        const result = await runClaude(options);
        return result.text;
      },
    },
  };
});
