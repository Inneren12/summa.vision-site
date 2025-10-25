interface ObserverRecord {
  readonly callback: IntersectionObserverCallback;
  readonly instance: IntersectionObserver;
  readonly observed: Set<Element>;
}

const observerRecords = new Set<ObserverRecord>();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;

  readonly rootMargin: string;

  readonly thresholds: ReadonlyArray<number>;

  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = options?.rootMargin ?? "";
    const thresholdOption = options?.threshold;
    if (Array.isArray(thresholdOption)) {
      this.thresholds = thresholdOption;
    } else if (typeof thresholdOption === "number") {
      this.thresholds = [thresholdOption];
    } else {
      this.thresholds = [];
    }
    this.record = {
      callback,
      instance: this,
      observed: new Set<Element>(),
    };
    observerRecords.add(this.record);
  }

  disconnect(): void {
    observerRecords.delete(this.record);
    this.record.observed.clear();
  }

  observe(target: Element): void {
    this.record.observed.add(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(target: Element): void {
    this.record.observed.delete(target);
  }

  static trigger(target: Element, entryInit: Partial<IntersectionObserverEntry> = {}): void {
    for (const record of Array.from(observerRecords)) {
      if (!record.observed.has(target)) {
        continue;
      }

      const rect = target.getBoundingClientRect?.() ?? {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}) as unknown,
      };

      const entry: IntersectionObserverEntry = {
        time: 0,
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: rect as DOMRectReadOnly,
        intersectionRect: rect as DOMRectReadOnly,
        rootBounds: null,
        ...entryInit,
      } as IntersectionObserverEntry;

      record.callback([entry], record.instance);
    }
  }
}

export function setupMockIntersectionObserver(): void {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
}

export function resetMockIntersectionObserver(): void {
  observerRecords.clear();
}

export function triggerIntersection(
  target: Element,
  entryInit: Partial<IntersectionObserverEntry> = {},
): void {
  const Observer = globalThis.IntersectionObserver as typeof MockIntersectionObserver | undefined;
  if (Observer && typeof (Observer as typeof MockIntersectionObserver).trigger === "function") {
    (Observer as typeof MockIntersectionObserver).trigger(target, entryInit);
  }
}
