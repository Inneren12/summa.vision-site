export type StoryEventKind = "impression" | "scroll" | "step" | "change" | "hash" | "restore";

export type StoryEvent = {
  type: StoryEventKind;
  slug: string;
  stepId?: string;
  position?: number;
  direction?: "forward" | "backward";
  hash?: string;
  from?: string;
  to?: string;
  clock: number;
};

const DEFAULT_SLUG = "demo";
const CLOCK_START = 1_708_992_500_000;
const CLOCK_STEP = 150;
let counter = 0;

function nextClock(): number {
  counter += 1;
  return CLOCK_START + counter * CLOCK_STEP;
}

function buildEvent(kind: StoryEventKind, overrides: Partial<StoryEvent> = {}): StoryEvent {
  const { slug = DEFAULT_SLUG, clock = nextClock(), ...rest } = overrides;
  return {
    type: kind,
    slug,
    clock,
    ...rest,
  };
}

export function resetEventClock(): void {
  counter = 0;
}

export function impression(stepId = "intro", overrides: Partial<StoryEvent> = {}): StoryEvent {
  return buildEvent("impression", { stepId, ...overrides });
}

export function scroll(position: number, overrides: Partial<StoryEvent> = {}): StoryEvent {
  return buildEvent("scroll", { position, ...overrides });
}

export function stepChange(
  stepId: string,
  direction: "forward" | "backward" = "forward",
  overrides: Partial<StoryEvent> = {},
): StoryEvent {
  return buildEvent("step", { stepId, direction, ...overrides });
}

export function viewportChange(
  from: string,
  to: string,
  overrides: Partial<StoryEvent> = {},
): StoryEvent {
  return buildEvent("change", { from, to, ...overrides });
}

export function hashChange(hash: string, overrides: Partial<StoryEvent> = {}): StoryEvent {
  return buildEvent("hash", { hash, ...overrides });
}

export function restore(stepId: string, overrides: Partial<StoryEvent> = {}): StoryEvent {
  return buildEvent("restore", { stepId, ...overrides });
}
