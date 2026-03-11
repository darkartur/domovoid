export interface AgentCapabilities {
  run(options: { prompt: string; workingDirectory: string }): Promise<string>;
}
