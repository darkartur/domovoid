import type { PluginEvent } from "./events.ts";

export interface TasksCapabilities {
  getActiveTasks(projectId: string): Promise<Task[]>;
  getProjects(): Promise<TaskProject[]>;
  postComment(taskId: string, result: string): Promise<void>;
}

export interface TaskProject {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
}

export type TasksEvent = PluginEvent<"tasks.newTask", Task>;
