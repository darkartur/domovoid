import type { AnyEvent } from "./any-event.ts";

export interface PluginContext {
  dataDirectory: string;
  sendEvent(event: AnyEvent): void;
}
