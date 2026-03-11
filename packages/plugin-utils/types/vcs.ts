interface VcsCloneOptions {
  depth?: number;
}

export interface VcsCapabilities {
  clone(repositoryUrl: string, directoryPath: string, options: VcsCloneOptions): Promise<void>;
  remove(directoryPath: string): Promise<void>;
}
