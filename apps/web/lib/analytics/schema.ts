import { z } from "zod";

export const EventBase = z.object({
  ts: z.number(),
  page: z.string(),
  locale: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

export const StoryEvents = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("story_view"), slug: z.string() }),
    z.object({ type: z.literal("step_view"), slug: z.string(), step: z.string() }),
    z.object({ type: z.literal("step_exit"), slug: z.string(), step: z.string() }),
    z.object({ type: z.literal("share_click"), slug: z.string(), channel: z.string().optional() }),
  ])
  .and(EventBase);

export const VizEvents = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("viz_state"), id: z.string(), state: z.record(z.unknown()) }),
    z.object({ type: z.literal("viz_error"), id: z.string(), message: z.string() }),
  ])
  .and(EventBase);

export const DashEvents = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("dash_view"), slug: z.string() }),
    z.object({
      type: z.literal("dash_filter_change"),
      slug: z.string(),
      key: z.string(),
      value: z.unknown(),
    }),
    z.object({ type: z.literal("dash_preset_load"), slug: z.string(), preset: z.string() }),
  ])
  .and(EventBase);

export const AnyEvent = z.union([StoryEvents, VizEvents, DashEvents]);
export type EventBase = z.infer<typeof EventBase>;
export type StoryEvent = z.infer<typeof StoryEvents>;
export type VizEvent = z.infer<typeof VizEvents>;
export type DashEvent = z.infer<typeof DashEvents>;
export type AnyEvent = z.infer<typeof AnyEvent>;

export const isStoryEvent = (event: unknown): event is StoryEvent =>
  StoryEvents.safeParse(event).success;

export const isVizEvent = (event: unknown): event is VizEvent => VizEvents.safeParse(event).success;

export const isDashEvent = (event: unknown): event is DashEvent =>
  DashEvents.safeParse(event).success;
