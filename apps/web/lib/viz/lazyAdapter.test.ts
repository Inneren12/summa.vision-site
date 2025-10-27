import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLazyAdapter } from "./lazyAdapter";

describe("createLazyAdapter", () => {
  beforeEach(() => {
    document.cookie = "sv_consent=all";
  });

  it("prefetches once, emits events, and delegates to the underlying adapter", async () => {
    const mount = vi.fn(async () => ({ id: "instance" }));
    const applyState = vi.fn();
    const destroy = vi.fn();

    const loader = vi.fn(async () => ({
      mount,
      applyState,
      destroy,
    }));

    const handle = createLazyAdapter("deck", loader);

    const events: string[] = [];
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        events.push((event.detail as { name?: string }).name ?? event.type);
      }
    };

    window.addEventListener("viz_prefetch", handler);
    window.addEventListener("viz_lazy_mount", handler);

    await handle.prefetch({ reason: "hover", discrete: false });
    await handle.prefetch({ reason: "hover", discrete: true });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(events.filter((name) => name === "viz_prefetch")).toHaveLength(1);

    const element = document.createElement("div");
    const instance = await handle.adapter.mount(element, { value: 1 }, { discrete: true });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(element, { value: 1 }, { discrete: true });
    expect(events.filter((name) => name === "viz_lazy_mount")).toHaveLength(1);

    handle.adapter.applyState(instance, { value: 2 }, { discrete: true });
    expect(applyState).toHaveBeenCalledWith(instance, { value: 2 }, { discrete: true });

    handle.adapter.destroy(instance);
    expect(destroy).toHaveBeenCalledWith(instance);

    window.removeEventListener("viz_prefetch", handler);
    window.removeEventListener("viz_lazy_mount", handler);
  });
});
