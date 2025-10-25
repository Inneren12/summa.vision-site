import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hashRegex = /^[A-Za-z0-9][A-Za-z0-9\-_.]*$/;

export const storyStepSchema = z
  .object({
    id: z
      .string({ required_error: "id is required" })
      .min(1, "id is required")
      .regex(slugRegex, "id must use lowercase kebab-case"),
    title: z.string({ required_error: "title is required" }).min(1, "title is required"),
    hash: z
      .string()
      .min(1, "hash must not be empty")
      .regex(hashRegex, "hash may only contain letters, numbers, hyphen, underscore or dot")
      .optional(),
  })
  .strict();

export const storyFrontMatterSchema = z
  .object({
    title: z.string({ required_error: "title is required" }).min(1, "title is required"),
    slug: z
      .string({ required_error: "slug is required" })
      .min(1, "slug is required")
      .regex(slugRegex, "slug must use lowercase kebab-case"),
    description: z
      .string({ required_error: "description is required" })
      .min(1, "description is required"),
    cover: z
      .object({
        src: z.string({ required_error: "cover.src is required" }).min(1, "cover.src is required"),
        alt: z.string({ required_error: "cover.alt is required" }).min(1, "cover.alt is required"),
      })
      .strict(),
    steps: z.array(storyStepSchema).min(1, "steps must include at least one entry"),
  })
  .strict();

const RELATIVE_URL_REGEX = /^(\/|https?:\/\/)/;

/**
 * Normalizes story front matter by applying defaults and additional validation.
 * @param {unknown} frontMatter
 * @param {string} filePath
 * @returns {import("zod").infer<typeof storyFrontMatterSchema>}
 */
export function normalizeStoryFrontMatter(frontMatter, filePath) {
  const parsed = storyFrontMatterSchema.safeParse(frontMatter);
  if (!parsed.success) {
    const error = parsed.error;
    const details = error.issues
      .map((issue) => `frontMatter.${issue.path.join(".")} – ${issue.message}`)
      .join("\n");
    throw new Error(details);
  }

  const normalizedSteps = parsed.data.steps.map((step) => ({
    ...step,
    hash: step.hash ?? `step-${step.id}`,
  }));

  const stepIds = new Set();
  const stepHashes = new Set();

  for (const step of normalizedSteps) {
    if (stepIds.has(step.id)) {
      throw new Error(`duplicate step id "${step.id}"`);
    }
    stepIds.add(step.id);

    if (stepHashes.has(step.hash)) {
      throw new Error(`duplicate step hash "${step.hash}"`);
    }
    stepHashes.add(step.hash);
  }

  if (!RELATIVE_URL_REGEX.test(parsed.data.cover.src)) {
    throw new Error(`cover.src must be a relative path starting with "/" or an absolute URL`);
  }

  return {
    ...parsed.data,
    steps: normalizedSteps,
  };
}
