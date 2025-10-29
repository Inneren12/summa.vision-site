import { describe, expect, it } from "vitest";

import { buildStoryAggregations } from "@/lib/stories/aggregations";
import type { StoryFrontMatter } from "@/lib/stories/schemas";

const FIXTURE_STORIES: StoryFrontMatter[] = [
  {
    title: "Solar build-out",
    slug: "solar-build",
    description: "Scaling microgrids across islands.",
    cover: { src: "/covers/solar-build.png", alt: "Workers installing solar panels" },
    steps: [
      { id: "intro", title: "Introduction", hash: "step-intro" },
      { id: "baseline", title: "Baseline", hash: "baseline" },
      { id: "momentum", title: "Momentum", hash: "step-momentum" },
    ],
    viz: {
      lib: "vega",
      spec: "./viz/solar.vl.json",
      needs: ["vega"],
    },
  },
  {
    title: "Mangrove recovery",
    slug: "mangrove-recovery",
    description: "Community-led restoration of blue carbon sites.",
    cover: { src: "/covers/mangroves.png", alt: "Mangrove forest" },
    steps: [
      { id: "intro", title: "Introduction", hash: "intro" },
      { id: "impact", title: "Impact", hash: "impact" },
      { id: "community", title: "Community", hash: "step-community" },
      { id: "outlook", title: "Outlook", hash: "outlook" },
    ],
    viz: {
      lib: "echarts",
      spec: "./viz/mangrove.json",
      needs: ["echarts", "maplibre"],
    },
  },
  {
    title: "Skills pipeline",
    slug: "skills-pipeline",
    description: "Reskilling cohorts for installation and maintenance.",
    cover: { src: "/covers/skills.png", alt: "Hands working with tools" },
    steps: [
      { id: "intro", title: "Introduction", hash: "intro" },
      { id: "partners", title: "Partners", hash: "step-partners" },
    ],
    viz: {
      lib: "visx",
      spec: "./viz/skills.json",
      needs: ["visx"],
    },
  },
  {
    title: "Policy tracker",
    slug: "policy-tracker",
    description: "Monitoring enabling legislation across regions.",
    cover: { src: "/covers/policy.png", alt: "Documents on a desk" },
    steps: [
      { id: "intro", title: "Introduction", hash: "intro" },
      { id: "status", title: "Status", hash: "status" },
      { id: "risks", title: "Risks", hash: "risks" },
      { id: "actions", title: "Actions", hash: "actions" },
      { id: "next", title: "Next steps", hash: "next" },
    ],
    viz: undefined,
  },
];

describe("story aggregations", () => {
  it("matches the expected snapshot", () => {
    const aggregations = buildStoryAggregations(FIXTURE_STORIES);
    expect(aggregations).toMatchInlineSnapshot(`
      {
        "stepsPerStory": [
          {
            "slug": "policy-tracker",
            "stepCount": 5,
            "title": "Policy tracker",
          },
          {
            "slug": "mangrove-recovery",
            "stepCount": 4,
            "title": "Mangrove recovery",
          },
          {
            "slug": "solar-build",
            "stepCount": 3,
            "title": "Solar build-out",
          },
          {
            "slug": "skills-pipeline",
            "stepCount": 2,
            "title": "Skills pipeline",
          },
        ],
        "totals": {
          "steps": 14,
          "stories": 4,
        },
        "vizLibraryUsage": [
          {
            "count": 1,
            "lib": "echarts",
          },
          {
            "count": 1,
            "lib": "none",
          },
          {
            "count": 1,
            "lib": "vega",
          },
          {
            "count": 1,
            "lib": "visx",
          },
        ],
        "vizNeedUsage": [
          {
            "need": "echarts",
            "occurrences": 1,
            "stories": 1,
          },
          {
            "need": "maplibre",
            "occurrences": 1,
            "stories": 1,
          },
          {
            "need": "vega",
            "occurrences": 1,
            "stories": 1,
          },
          {
            "need": "visx",
            "occurrences": 1,
            "stories": 1,
          },
        ],
      }
    `);
  });
});
