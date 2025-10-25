import { z } from "zod";

export declare const storyStepSchema: z.ZodObject<
  {
    id: z.ZodString;
    title: z.ZodString;
    hash: z.ZodOptional<z.ZodString>;
  },
  "strict",
  z.ZodTypeAny,
  {
    id: string;
    title: string;
    hash?: string | undefined;
  },
  {
    id: string;
    title: string;
    hash?: string | undefined;
  }
>;

export declare const storyFrontMatterSchema: z.ZodObject<
  {
    title: z.ZodString;
    slug: z.ZodString;
    description: z.ZodString;
    cover: z.ZodObject<
      {
        src: z.ZodString;
        alt: z.ZodString;
      },
      "strict",
      z.ZodTypeAny,
      {
        src: string;
        alt: string;
      },
      {
        src: string;
        alt: string;
      }
    >;
    steps: z.ZodArray<typeof storyStepSchema, "many">;
  },
  "strict",
  z.ZodTypeAny,
  {
    title: string;
    slug: string;
    description: string;
    cover: {
      src: string;
      alt: string;
    };
    steps: Array<z.infer<typeof storyStepSchema>>;
  },
  {
    title: string;
    slug: string;
    description: string;
    cover: {
      src: string;
      alt: string;
    };
    steps: Array<z.infer<typeof storyStepSchema>>;
  }
>;

export type StoryStep = z.infer<typeof storyStepSchema> & { hash: string };
export type StoryFrontMatter = Omit<z.infer<typeof storyFrontMatterSchema>, "steps"> & {
  steps: StoryStep[];
};

export declare function normalizeStoryFrontMatter(
  frontMatter: unknown,
  filePath: string,
): StoryFrontMatter;
