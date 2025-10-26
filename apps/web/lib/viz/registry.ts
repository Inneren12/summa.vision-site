import type { VizAdapter, VizLibraryTag } from "./types";

type RegistryEntry = VizAdapter<unknown, unknown>;

const registry = new Map<VizLibraryTag, RegistryEntry>();

function toAdapter<TInstance, TSpec>(
  entry: RegistryEntry | undefined,
): VizAdapter<TInstance, TSpec> | undefined {
  return entry as VizAdapter<TInstance, TSpec> | undefined;
}

export function registerAdapter<TInstance, TSpec>(
  lib: VizLibraryTag,
  adapter: VizAdapter<TInstance, TSpec>,
): void {
  registry.set(lib, adapter as RegistryEntry);
}

export function getAdapter<TInstance, TSpec>(
  lib: VizLibraryTag,
): VizAdapter<TInstance, TSpec> | undefined {
  return toAdapter<TInstance, TSpec>(registry.get(lib));
}

export function requireAdapter<TInstance, TSpec>(lib: VizLibraryTag): VizAdapter<TInstance, TSpec> {
  const adapter = getAdapter<TInstance, TSpec>(lib);
  if (!adapter) {
    throw new Error(`Visualization adapter for "${lib}" is not registered`);
  }
  return adapter;
}

export function unregisterAdapter(lib: VizLibraryTag): void {
  registry.delete(lib);
}

export function clearRegistry(): void {
  registry.clear();
}

export function listRegisteredAdapters(): VizLibraryTag[] {
  return Array.from(registry.keys());
}
