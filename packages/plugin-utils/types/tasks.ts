export interface TasksCapabilities {
  getActiveTasks(): Promise<Task[]>;
  getProjects(): Promise<TaskProject[]>;
}

export interface TaskProject {
  id: string;
  name: string;
}

export interface Task {
  id: unknown;
  title: string;
  description: string;
  projectId: string;
  repositoryUrl: string;
}
