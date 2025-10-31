import { z } from "zod";

const consentSchema = z.enum(["all", "necessary"]).optional();

const nonNegativeInteger = z.number().int().min(0);

const isoTimestamp = z.string().datetime({ message: "Invalid ISO timestamp" });

const stringIdentifier = z.string().min(1);

const optionalStringIdentifier = z.string().min(1).optional();

export const AnyEvent = z
  .object({
    event: z.string().min(1),
    storyId: stringIdentifier,
    ts: isoTimestamp,
    stepCount: nonNegativeInteger.optional(),
    stepIndex: nonNegativeInteger.optional(),
    stepId: optionalStringIdentifier,
    url: z.string().min(1).optional(),
    referrer: z.string().min(1).optional(),
    consent: consentSchema,
  })
  .passthrough();

export type AnyEventPayload = z.infer<typeof AnyEvent>;
