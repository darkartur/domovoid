export interface AgentCapabilities {
  run(arguments_: { prompt: string; workingDirectory: string }): Promise<string>;
}
