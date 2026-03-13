import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

export function createOctokitClient(): Octokit {
  const appId = process.env["GITHUB_APP_ID"];
  const privateKey = process.env["GITHUB_APP_PRIVATE_KEY"];
  const installationId = process.env["GITHUB_APP_INSTALLATION_ID"];

  if (appId && privateKey && installationId) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey: privateKey.replaceAll(String.raw`\n`, "\n"),
        installationId: Number(installationId),
      },
    });
  }

  const token = process.env["GITHUB_TOKEN"];
  if (!token) throw new Error("Either GITHUB_APP_* vars or GITHUB_TOKEN is required");
  return new Octokit({ auth: token });
}
