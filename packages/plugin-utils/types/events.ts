export interface PluginEvent<TName extends string, TPayload> {
  name: TName;
  payload: TPayload;
}
