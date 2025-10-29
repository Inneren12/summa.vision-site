import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hashRegex = /^[A-Za-z0-9][A-Za-z0-9\-_.]*$/;
const relativeSpecRegex = /^(\.{1,2}\/).+/;
const coverSrcRegex = /^(\/|https?:\/\/)/;

export const storyVisualizationNeedSchema = z.enum(["vega", "echarts", "maplibre", "visx", "deck"]);

export type StoryVisualizationNeed = z.infer<typeof storyVisualizationNeedSchema>;

const storyStepBaseSchema = z
  .object({
    id: z.string().min(1, "id is required").regex(slugRegex, "id must use lowercase kebab-case"),
    title: z.string().min(1, "title is required"),
    hash: z
      .string()
      .min(1, "hash must not be empty")
      .regex(hashRegex, "hash may only contain letters, numbers, hyphen, underscore or dot")
      .optional(),
  })
  .strict();

export const storyStepSchema = storyStepBaseSchema.transform((step) => ({
  ...step,
  hash: step.hash ?? step.id,
}));

export type StoryStep = z.infer<typeof storyStepSchema>;

const storyVisualizationSchema = z
  .object({
    lib: storyVisualizationNeedSchema,
    spec: z
      .string()
      .min(1, "spec must not be empty")
      .regex(relativeSpecRegex, "spec must be a relative path starting with ./ or ../")
      .optional(),
    needs: z.array(storyVisualizationNeedSchema).min(1, "needs must not be empty").optional(),
  })
  .strict()
  .transform((viz) => ({
    ...viz,
    needs: Array.from(new Set(viz.needs ?? [])),
  }));

const storyFrontMatterBaseSchema = z
  .object({
    title: z.string().min(1, "title is required"),
    slug: z
      .string()
      .min(1, "slug is required")
      .regex(slugRegex, "slug must use lowercase kebab-case"),
    description: z.string().min(1, "description is required"),
    cover: z
      .object({
        src: z
          .string()
          .min(1, "cover.src is required")
          .regex(
            coverSrcRegex,
            "cover.src must be a relative path starting with '/' or an absolute URL",
          ),
        alt: z.string().min(1, "cover.alt is required"),
      })
      .strict(),
    steps: z.array(storyStepSchema).min(1, "steps must include at least one entry"),
    viz: storyVisualizationSchema.optional(),
  })
  .strict()
  .superRefine((story, ctx) => {
    const ids = new Set<string>();
    const hashes = new Set<string>();
    story.steps.forEach((step, index) => {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate step id "${step.id}"`,
          path: ["steps", index, "id"],
        });
      } else {
        ids.add(step.id);
      }

      const hash = step.hash ?? step.id;
      if (hashes.has(hash)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate step hash "${hash}"`,
          path: ["steps", index, "hash"],
        });
      } else {
        hashes.add(hash);
      }
    });

    const needs = story.viz?.needs ?? [];
    if (needs.length > 0) {
      const uniqueNeeds = new Set(needs);
      if (uniqueNeeds.size !== needs.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "viz.needs entries must be unique",
          path: ["viz", "needs"],
        });
      }
    }
  });

export const storyFrontMatterSchema = storyFrontMatterBaseSchema.transform((story) => ({
  ...story,
  steps: story.steps.map((step) => ({ ...step, hash: step.hash ?? step.id })),
  viz: story.viz ? { ...story.viz, needs: story.viz.needs ?? [] } : undefined,
}));

export type StoryFrontMatter = z.infer<typeof storyFrontMatterSchema>;

export const storyIndexResponseSchema = z
  .object({
    stories: z.array(storyFrontMatterSchema),
    generatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type StoryIndexResponse = z.infer<typeof storyIndexResponseSchema>;

export const storyIndexCacheSchema = z
  .object({
    stories: z.array(storyFrontMatterSchema),
    cachedAt: z.number().nonnegative(),
  })
  .strict();

export type StoryIndexCache = z.infer<typeof storyIndexCacheSchema>;

export const storyVisualizationSpecSchema = z.object({}).passthrough();

export type StoryVisualizationSpec = z.infer<typeof storyVisualizationSpecSchema>;
