export interface VcsCapabilities {
  clone(repositoryUrl: string, directoryPath: string): Promise<void>;
}
