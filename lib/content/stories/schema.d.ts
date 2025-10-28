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

declare const vizLibrarySchema: z.ZodEnum<["vega", "echarts", "maplibre", "visx", "deck"]>;

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
    viz: z.ZodOptional<
      z.ZodObject<
        {
          lib: z.ZodEnum<["vega", "echarts", "maplibre", "visx", "deck"]>;
          spec: z.ZodOptional<z.ZodString>;
          needs: z.ZodOptional<
            z.ZodArray<z.ZodEnum<["vega", "echarts", "maplibre", "visx", "deck"]>, "many">
          >;
        },
        "strict",
        z.ZodTypeAny,
        {
          lib: "vega" | "echarts" | "maplibre" | "visx" | "deck";
          spec?: string | undefined;
          needs?: ("vega" | "echarts" | "maplibre" | "visx" | "deck")[] | undefined;
        },
        {
          lib: "vega" | "echarts" | "maplibre" | "visx" | "deck";
          spec?: string | undefined;
          needs?: ("vega" | "echarts" | "maplibre" | "visx" | "deck")[] | undefined;
        }
      >
    >;
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
    viz?:
      | {
          lib: "vega" | "echarts" | "maplibre" | "visx" | "deck";
          spec?: string | undefined;
          needs?: ("vega" | "echarts" | "maplibre" | "visx" | "deck")[] | undefined;
        }
      | undefined;
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
    viz?:
      | {
          lib: "vega" | "echarts" | "maplibre" | "visx" | "deck";
          spec?: string | undefined;
          needs?: ("vega" | "echarts" | "maplibre" | "visx" | "deck")[] | undefined;
        }
      | undefined;
  }
>;

export type StoryStep = z.infer<typeof storyStepSchema> & { hash: string };
export type StoryVisualizationNeed = z.infer<typeof vizLibrarySchema>;
export type StoryVisualizationConfig = {
  lib: StoryVisualizationNeed;
  spec?: string;
  needs: StoryVisualizationNeed[];
};
export type StoryFrontMatter = Omit<z.infer<typeof storyFrontMatterSchema>, "steps" | "viz"> & {
  steps: StoryStep[];
  viz?: StoryVisualizationConfig;
};

export declare function normalizeStoryFrontMatter(
  frontMatter: unknown,
  filePath: string,
): StoryFrontMatter;
