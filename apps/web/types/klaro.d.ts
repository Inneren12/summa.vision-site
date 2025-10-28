declare module "klaro/dist/klaro-no-css.js" {
  export type KlaroManager = {
    readonly consents: Record<string, boolean | undefined>;
    watch: (watcher: {
      update: (manager: KlaroManager, eventName: string, data: unknown) => void;
    }) => void;
    unwatch: (watcher: {
      update: (manager: KlaroManager, eventName: string, data: unknown) => void;
    }) => void;
  };

  export type KlaroConfig = Record<string, unknown>;

  export const setup: (config?: KlaroConfig) => void;
  export const show: (config?: KlaroConfig, modal?: boolean, api?: unknown) => void;
  export const getManager: (config?: KlaroConfig) => KlaroManager;
}
